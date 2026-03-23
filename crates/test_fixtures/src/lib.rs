pub const UFBA_SIM_SCHEDULE_CODES_HTML: &str =
    include_str!("../../../fixtures/public/ufba-sim-schedule-codes.html");
pub const IHAC_UFBA_TIMETABLE_HTML: &str =
    include_str!("../../../fixtures/public/ihac-ufba-timetable.html");
pub const SIGAA_PUBLIC_TURMAS_HTML: &str =
    include_str!("../../../fixtures/public/sigaa-public-turmas.html");

pub fn public_fixture_names() -> [&'static str; 3] {
    [
        "ufba-sim-schedule-codes",
        "ihac-ufba-timetable",
        "sigaa-public-turmas",
    ]
}
