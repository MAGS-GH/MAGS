using System.Buffers.Binary;
using Npgsql;
using static SalonPlatform.OpsData;

namespace SalonPlatform;

public static partial class OpsEndpoints
{
    private const int MaxImageBytes = 3 * 1024 * 1024;
    private const int MaxSalonImageBytes = 128 * 1024 * 1024;

    private static async Task<IResult> Upload(HttpContext ctx,NpgsqlDataSource source,Guid id)
    {
        if ((await OpsAuth.Access(ctx,source,id))?.Manages != true) throw new SalonError(403,"Du har ikke adgang til salonens billeder.");
        var mime = ctx.Request.ContentType?.Split(';')[0].Trim().ToLowerInvariant();
        if (mime is not ("image/png" or "image/jpeg" or "image/webp")) throw new SalonError(415,"Vælg en PNG-, JPEG- eller WebP-fil.");
        if (ctx.Request.ContentLength > MaxImageBytes) throw new SalonError(413,"Billedet må højst fylde 3 MB.");
        using var bytes = new MemoryStream();
        var buffer = new byte[16_384];
        int read;
        while ((read = await ctx.Request.Body.ReadAsync(buffer,ctx.RequestAborted)) != 0)
        {
            if (bytes.Length + read > MaxImageBytes) throw new SalonError(413,"Billedet må højst fylde 3 MB.");
            await bytes.WriteAsync(buffer.AsMemory(0,read),ctx.RequestAborted);
        }
        var data = bytes.ToArray();
        var dimensions = ImageDimensions(data,mime);
        if (dimensions is not { Width: > 0 and <= 6000, Height: > 0 and <= 6000 } || (long)dimensions.Value.Width * dimensions.Value.Height > 24_000_000)
            throw new SalonError(400,"Billedformatet eller størrelsen understøttes ikke.");
        return await Manage(ctx,source,id,async (db,tx) =>
        {
            // Drop abandoned uploads after allowing enough time to finish editing.
            await Execute(db,tx,"""
                DELETE FROM media m WHERE m.salon_id=@s AND m.created_at<now()-interval '1 day'
                AND NOT EXISTS (SELECT 1 FROM salons s WHERE s.id=@s AND '/api/media/'||m.salon_id||'/'||m.id IN (s.logo_url,s.cover_url))
                AND NOT EXISTS (SELECT 1 FROM services v WHERE v.salon_id=@s AND v.photo_url='/api/media/'||m.salon_id||'/'||m.id)
                AND NOT EXISTS (SELECT 1 FROM staff p WHERE p.salon_id=@s AND p.photo_url='/api/media/'||m.salon_id||'/'||m.id)
                """,("s",id));
            await using var quota = Command(db,tx,"SELECT coalesce(sum(octet_length(contents)),0)::bigint FROM media WHERE salon_id=@s",("s",id));
            if ((long)(await quota.ExecuteScalarAsync())! + data.Length > MaxSalonImageBytes) throw new SalonError(409,"Salonens billedlager er fyldt. Fjern gamle billeder eller kontakt MAGS.");
            var mediaId = Guid.NewGuid();
            await Execute(db,tx,"INSERT INTO media(id,salon_id,mime,contents) VALUES(@i,@s,@m,@b)",("i",mediaId),("s",id),("m",mime),("b",data));
            await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"media.uploaded",mediaId);
            return Results.Ok(new {url=$"/api/media/{id}/{mediaId}"});
        });
    }

    private static (int Width,int Height)? ImageDimensions(ReadOnlySpan<byte> image,string mime)
    {
        if (mime == "image/png" && image.Length >= 33 && image[..8].SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}) && image[12..16].SequenceEqual("IHDR"u8))
            return (BinaryPrimitives.ReadInt32BigEndian(image[16..]),BinaryPrimitives.ReadInt32BigEndian(image[20..]));
        if (mime == "image/webp" && image.Length >= 30 && image[..4].SequenceEqual("RIFF"u8) && image[8..12].SequenceEqual("WEBP"u8))
        {
            if (image[12..16].SequenceEqual("VP8X"u8))
                return (1 + image[24] + (image[25]<<8) + (image[26]<<16),1 + image[27] + (image[28]<<8) + (image[29]<<16));
            if (image[12..16].SequenceEqual("VP8L"u8) && image[20]==0x2f)
            {
                var packed = BinaryPrimitives.ReadUInt32LittleEndian(image[21..]);
                return ((int)(packed & 0x3fff)+1,(int)((packed>>14)&0x3fff)+1);
            }
            if (image[12..16].SequenceEqual("VP8 "u8) && image[23..26].SequenceEqual(new byte[]{0x9d,0x01,0x2a}))
                return (BinaryPrimitives.ReadUInt16LittleEndian(image[26..]) & 0x3fff,BinaryPrimitives.ReadUInt16LittleEndian(image[28..]) & 0x3fff);
        }
        if (mime == "image/jpeg" && image.Length>4 && image[0]==0xff && image[1]==0xd8)
        {
            for (var offset=2;offset+4<=image.Length;)
            {
                if (image[offset++]!=0xff) break;
                var marker = image[offset++];
                if (marker==0xff) { offset--; continue; }
                if (marker is 0xda or 0xd9) break;
                if (marker is 0x01 or >=0xd0 and <=0xd7) continue;
                var size = BinaryPrimitives.ReadUInt16BigEndian(image[offset..]);
                if (size<2 || offset+size>image.Length) break;
                if (size>=8 && marker is 0xc0 or 0xc1 or 0xc2)
                    return (BinaryPrimitives.ReadUInt16BigEndian(image[(offset+5)..]),BinaryPrimitives.ReadUInt16BigEndian(image[(offset+3)..]));
                offset+=size;
            }
        }
        return null;
    }

    private static async Task<IResult> Media(HttpContext ctx,NpgsqlDataSource source,Guid id,Guid mediaId)
    {
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        await using var cmd = Command(db,null,"SELECT mime,contents FROM media WHERE id=@m AND salon_id=@s",("m",mediaId),("s",id));
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return Results.NotFound();
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
        ctx.Response.Headers.CacheControl = "public, max-age=86400";
        return Results.File(reader.GetFieldValue<byte[]>(1),reader.GetString(0));
    }
}
