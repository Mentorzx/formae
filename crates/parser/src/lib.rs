use formae_domain::{
    Meeting, ScheduleParseResult, ScheduleParseWarning, ScheduleParseWarningCode, TimingProfileId,
    TurnCode, Weekday, lookup_slot,
};
use regex::Regex;
use std::sync::LazyLock;

static GROUP_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([2-7]+)\s*([MTN])\s*([0-9]+)").expect("valid schedule regex"));

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedSegment {
    days: Vec<Weekday>,
    turn: TurnCode,
    slots: Vec<u8>,
    canonical: String,
}

impl ParsedSegment {
    fn sort_key(&self) -> (Weekday, TurnCode, u8, usize) {
        let first_day = *self.days.first().expect("segment with at least one day");
        let first_slot = *self.slots.first().expect("segment with at least one slot");
        (first_day, self.turn, first_slot, self.days.len())
    }

    fn to_meetings(&self, profile_id: TimingProfileId) -> Vec<Meeting> {
        let ranges = contiguous_ranges(&self.slots);

        self.days
            .iter()
            .flat_map(|day| {
                ranges.iter().filter_map(|(slot_start, slot_end)| {
                    let start = lookup_slot(profile_id, self.turn, *slot_start)?;
                    let end = lookup_slot(profile_id, self.turn, *slot_end)?;

                    Some(Meeting {
                        day: *day,
                        turn: self.turn,
                        slot_start: *slot_start,
                        slot_end: *slot_end,
                        start_time: start.start,
                        end_time: end.end,
                        source_segment: self.canonical.clone(),
                    })
                })
            })
            .collect()
    }
}

pub fn parse_schedule_code(raw: &str, profile_id: TimingProfileId) -> ScheduleParseResult {
    let mut warnings = Vec::new();
    let trimmed = raw.trim();
    let normalized_code = normalize_code(trimmed);

    if trimmed.is_empty() {
        warnings.push(warning(
            ScheduleParseWarningCode::EmptyInput,
            "Schedule code is empty after trimming input.",
        ));
        return ScheduleParseResult {
            raw_code: raw.to_owned(),
            normalized_code,
            canonical_code: String::new(),
            meetings: Vec::new(),
            warnings,
            profile_id,
        };
    }

    if collapse_whitespace(trimmed) != trimmed {
        warnings.push(warning(
            ScheduleParseWarningCode::NormalizedWhitespace,
            "Whitespace was normalized before parsing the schedule code.",
        ));
    }

    if trimmed != trimmed.to_uppercase() {
        warnings.push(warning(
            ScheduleParseWarningCode::NormalizedCase,
            "Input was uppercased before parsing the schedule code.",
        ));
    }

    let mut segments = Vec::new();
    let mut last_end = 0;

    for captures in GROUP_REGEX.captures_iter(&normalized_code) {
        let full_match = captures.get(0).expect("full regex match");
        let gap = &normalized_code[last_end..full_match.start()];
        if gap.chars().any(|character| !character.is_whitespace()) {
            warnings.push(warning(
                ScheduleParseWarningCode::UnparsedToken,
                format!("Ignored unexpected token sequence: {gap}"),
            ));
        }

        let day_codes = captures.get(1).expect("day capture").as_str();
        let turn_code = captures
            .get(2)
            .expect("turn capture")
            .as_str()
            .chars()
            .next()
            .expect("turn char");
        let slot_codes = captures.get(3).expect("slot capture").as_str();

        if let Some(segment) = parse_segment(day_codes, turn_code, slot_codes, &mut warnings) {
            segments.push(segment);
        }

        last_end = full_match.end();
    }

    let trailing = &normalized_code[last_end..];
    if trailing.chars().any(|character| !character.is_whitespace()) {
        warnings.push(warning(
            ScheduleParseWarningCode::UnparsedToken,
            format!("Ignored unexpected trailing token sequence: {trailing}"),
        ));
    }

    let original_order: Vec<_> = segments.iter().map(ParsedSegment::sort_key).collect();
    segments.sort_by_key(ParsedSegment::sort_key);
    let canonical_order: Vec<_> = segments.iter().map(ParsedSegment::sort_key).collect();

    if original_order != canonical_order {
        warnings.push(warning(
            ScheduleParseWarningCode::ReorderedSegments,
            "Segments were reordered to the canonical UFBA sequence.",
        ));
    }

    let canonical_code = segments
        .iter()
        .map(|segment| segment.canonical.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let meetings = segments
        .iter()
        .flat_map(|segment| segment.to_meetings(profile_id))
        .collect();

    ScheduleParseResult {
        raw_code: raw.to_owned(),
        normalized_code,
        canonical_code,
        meetings,
        warnings,
        profile_id,
    }
}

fn parse_segment(
    day_codes: &str,
    turn_code: char,
    slot_codes: &str,
    warnings: &mut Vec<ScheduleParseWarning>,
) -> Option<ParsedSegment> {
    let turn = TurnCode::from_sigaa_code(turn_code)?;

    let raw_days: Vec<_> = day_codes
        .chars()
        .filter_map(Weekday::from_sigaa_digit)
        .collect();
    let raw_slots: Vec<_> = slot_codes
        .chars()
        .filter_map(|character| character.to_digit(10))
        .filter_map(|value| u8::try_from(value).ok())
        .collect();

    let mut canonicalized = false;
    let mut days = raw_days.clone();
    days.sort();
    if days != raw_days {
        canonicalized = true;
    }
    let original_day_len = days.len();
    days.dedup();
    if days.len() != original_day_len {
        warnings.push(warning(
            ScheduleParseWarningCode::DeduplicatedDays,
            format!(
                "Duplicated day codes were removed from segment {day_codes}{turn_code}{slot_codes}."
            ),
        ));
    }

    let max_slot = turn.max_slot();
    let mut slots = Vec::new();
    for slot in raw_slots {
        if slot == 0 || slot > max_slot {
            warnings.push(warning(
                ScheduleParseWarningCode::OutOfRangeSlot,
                format!("Ignored slot {slot} for turn {turn_code}; maximum slot is {max_slot}."),
            ));
            continue;
        }
        slots.push(slot);
    }

    let raw_slots_after_validation = slots.clone();
    slots.sort();
    if slots != raw_slots_after_validation {
        canonicalized = true;
    }
    let original_slot_len = slots.len();
    slots.dedup();
    if slots.len() != original_slot_len {
        warnings.push(warning(
            ScheduleParseWarningCode::DeduplicatedSlots,
            format!(
                "Duplicated slots were removed from segment {day_codes}{turn_code}{slot_codes}."
            ),
        ));
    }

    if days.is_empty() || slots.is_empty() {
        return None;
    }

    if canonicalized {
        warnings.push(warning(
            ScheduleParseWarningCode::CanonicalizedSegment,
            format!("Canonicalized segment {day_codes}{turn_code}{slot_codes}."),
        ));
    }

    let canonical_days: String = days.iter().map(|day| day.sigaa_digit()).collect();
    let canonical_slots: String = slots.iter().map(u8::to_string).collect();
    let canonical = format!("{canonical_days}{}{canonical_slots}", turn.sigaa_code());

    Some(ParsedSegment {
        days,
        turn,
        slots,
        canonical,
    })
}

fn contiguous_ranges(slots: &[u8]) -> Vec<(u8, u8)> {
    if slots.is_empty() {
        return Vec::new();
    }

    let mut ranges = Vec::new();
    let mut range_start = slots[0];
    let mut previous = slots[0];

    for slot in slots.iter().copied().skip(1) {
        if slot == previous + 1 {
            previous = slot;
            continue;
        }

        ranges.push((range_start, previous));
        range_start = slot;
        previous = slot;
    }

    ranges.push((range_start, previous));
    ranges
}

fn normalize_code(input: &str) -> String {
    collapse_whitespace(input).to_uppercase()
}

fn collapse_whitespace(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn warning(code: ScheduleParseWarningCode, message: impl Into<String>) -> ScheduleParseWarning {
    ScheduleParseWarning {
        code,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::parse_schedule_code;
    use formae_domain::{ScheduleParseWarningCode, TimingProfileId, TurnCode, Weekday};

    #[test]
    fn canonicalizes_ufba_night_block() {
        let parsed = parse_schedule_code("35N12", TimingProfileId::Ufba2025);

        assert_eq!(parsed.canonical_code, "35N12");
        assert_eq!(parsed.meetings.len(), 2);
        assert!(parsed.warnings.is_empty());
        assert_eq!(parsed.meetings[0].day, Weekday::Tuesday);
        assert_eq!(parsed.meetings[0].turn, TurnCode::Night);
        assert_eq!(parsed.meetings[0].start_time.to_string(), "18:30");
        assert_eq!(parsed.meetings[0].end_time.to_string(), "20:20");
        assert_eq!(parsed.meetings[1].day, Weekday::Thursday);
    }

    #[test]
    fn preserves_simple_morning_block() {
        let parsed = parse_schedule_code("2M12", TimingProfileId::Ufba2025);

        assert_eq!(parsed.canonical_code, "2M12");
        assert_eq!(parsed.meetings.len(), 1);
        assert_eq!(parsed.meetings[0].start_time.to_string(), "07:00");
        assert_eq!(parsed.meetings[0].end_time.to_string(), "08:50");
    }

    #[test]
    fn parses_two_segments_with_different_turns() {
        let parsed = parse_schedule_code("3M23 5T23", TimingProfileId::Ufba2025);

        assert_eq!(parsed.canonical_code, "3M23 5T23");
        assert_eq!(parsed.meetings.len(), 2);
        assert_eq!(parsed.meetings[0].day, Weekday::Tuesday);
        assert_eq!(parsed.meetings[0].start_time.to_string(), "07:55");
        assert_eq!(parsed.meetings[1].day, Weekday::Thursday);
        assert_eq!(parsed.meetings[1].start_time.to_string(), "13:55");
    }

    #[test]
    fn warns_when_segments_are_out_of_order() {
        let parsed = parse_schedule_code("5T23 3M23", TimingProfileId::Ufba2025);

        assert_eq!(parsed.canonical_code, "3M23 5T23");
        assert!(
            parsed
                .warnings
                .iter()
                .any(|warning| warning.code == ScheduleParseWarningCode::ReorderedSegments)
        );
    }

    #[test]
    fn keeps_partial_result_for_invalid_input() {
        let parsed = parse_schedule_code("35N12 ZZ 2M99", TimingProfileId::Ufba2025);

        assert_eq!(parsed.canonical_code, "35N12");
        assert_eq!(parsed.meetings.len(), 2);
        assert!(
            parsed
                .warnings
                .iter()
                .any(|warning| warning.code == ScheduleParseWarningCode::UnparsedToken)
        );
        assert!(
            parsed
                .warnings
                .iter()
                .any(|warning| warning.code == ScheduleParseWarningCode::OutOfRangeSlot)
        );
    }
}
