using Mags.Booking;
using Xunit;

public sealed class BookingHoursTests
{
    [Fact]
    public void WeekendSlotsFollowDanishSummerTimeAndOperatingHours()
    {
        var now = new DateTimeOffset(2027, 3, 26, 6, 0, 0, TimeSpan.Zero);
        var availability = BookingHours.Available(now, [], []);

        Assert.Equal("Europe/Copenhagen", availability.TimeZone);
        Assert.Equal(30, availability.Days.Count);
        Assert.Equal(new DateOnly(2027, 4, 25), availability.Days.Last().Date);
        var saturday = availability.Days[0].Slots;
        var sunday = availability.Days[1].Slots;
        Assert.Equal(16, saturday.Count);
        Assert.Equal(16, sunday.Count);
        Assert.Equal(7, saturday[0].Start.Hour);
        Assert.Equal(6, sunday[0].Start.Hour);
        Assert.Equal(14, sunday[^1].End.Hour);
        Assert.False(BookingHours.IsAllowed(new Slot(sunday[^1].End, sunday[^1].End.AddMinutes(30)), now));
    }

    [Fact]
    public void NoticeIs24ElapsedHoursAcrossClockChange()
    {
        var now = new DateTimeOffset(2027, 3, 27, 7, 31, 0, TimeSpan.Zero);
        var slots = BookingHours.Available(now, [], []).Days[0].Slots;
        Assert.Equal(new DateTimeOffset(2027, 3, 28, 8, 0, 0, TimeSpan.Zero), slots[0].Start);
        Assert.False(BookingHours.IsAllowed(new Slot(slots[0].Start.AddMinutes(-30), slots[0].Start), now));
        Assert.True(BookingHours.IsAllowed(slots[0], now));
    }

    [Theory]
    [InlineData("busy", false, "accepted", true)]
    [InlineData("tentative", false, "accepted", true)]
    [InlineData("oof", false, "accepted", true)]
    [InlineData("workingElsewhere", false, "accepted", true)]
    [InlineData("free", false, "accepted", false)]
    [InlineData("busy", true, "accepted", false)]
    [InlineData("busy", false, "declined", false)]
    public void OutlookStatusControlsAvailability(string showAs, bool cancelled, string response, bool blocked)
    {
        var now = new DateTimeOffset(2027, 3, 26, 6, 0, 0, TimeSpan.Zero);
        var slot = BookingHours.Available(now, [], []).Days[0].Slots[0];
        Assert.Equal(blocked, BookingHours.Overlaps(slot, [new CalendarEntry("appointment", slot, cancelled, response, showAs, false)]));
        Assert.False(BookingHours.Overlaps(slot, [new CalendarEntry("appointment", new Slot(slot.End, slot.End.AddMinutes(30)), false, "accepted", "busy", false)]));
    }
}
