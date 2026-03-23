use formae_domain::TimingProfileId;
use formae_parser::parse_schedule_code;
use formae_test_fixtures::{
    IHAC_UFBA_TIMETABLE_HTML, SIGAA_PUBLIC_TURMAS_HTML, UFBA_SIM_SCHEDULE_CODES_HTML,
};

#[test]
fn fixture_replay_finds_expected_schedule_codes() {
    for code in ["35N12", "2M12", "3M23", "5T23"] {
        let parsed = parse_schedule_code(code, TimingProfileId::Ufba2025);
        assert!(
            !parsed.meetings.is_empty(),
            "expected meetings for fixture code {code}"
        );
    }

    assert!(UFBA_SIM_SCHEDULE_CODES_HTML.contains("35N12"));
    assert!(IHAC_UFBA_TIMETABLE_HTML.contains("18:30"));
    assert!(SIGAA_PUBLIC_TURMAS_HTML.contains("3M23 5T23"));
}
