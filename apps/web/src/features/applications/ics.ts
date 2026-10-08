type CalendarEvent = {
	uid: string;
	title: string;
	start: Date;
	end: Date;
	location?: string;
	description?: string;
};

// RFC 5545: commas, semicolons and backslashes are escaped, line breaks become \n.
const escapeText = (value: string) =>
	value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utcStamp = (date: Date) =>
	date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");

// Lines longer than 75 octets fold onto continuation lines that start with a space.
function fold(line: string) {
	const parts: string[] = [];
	let rest = line;
	while (rest.length > 75) {
		parts.push(rest.slice(0, 75));
		rest = ` ${rest.slice(75)}`;
	}
	parts.push(rest);
	return parts.join("\r\n");
}

/** One event as an .ics file's text, in UTC, for "Add to calendar". */
export function buildIcs(event: CalendarEvent, now = new Date()): string {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Reactive Resume//Applications//EN",
		"CALSCALE:GREGORIAN",
		"BEGIN:VEVENT",
		`UID:${event.uid}@reactive-resume`,
		`DTSTAMP:${utcStamp(now)}`,
		`DTSTART:${utcStamp(event.start)}`,
		`DTEND:${utcStamp(event.end)}`,
		`SUMMARY:${escapeText(event.title)}`,
		...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
		...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
		"END:VEVENT",
		"END:VCALENDAR",
	];

	return `${lines.map(fold).join("\r\n")}\r\n`;
}
