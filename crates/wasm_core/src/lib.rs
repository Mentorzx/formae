use formae_domain::TimingProfileId;
use formae_parser::parse_schedule_code;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = parseScheduleCode)]
pub fn parse_schedule_code_js(raw: &str, profile_id: &str) -> Result<JsValue, JsValue> {
    let profile = TimingProfileId::try_from(profile_id)
        .map_err(|message| JsValue::from_str(message.as_str()))?;
    let parsed = parse_schedule_code(raw, profile);
    serde_wasm_bindgen::to_value(&parsed).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen(js_name = parseUfbaScheduleCode)]
pub fn parse_ufba_schedule_code(raw: &str) -> Result<JsValue, JsValue> {
    parse_schedule_code_js(raw, TimingProfileId::Ufba2025.as_str())
}

#[wasm_bindgen(js_name = supportedTimingProfiles)]
pub fn supported_timing_profiles() -> JsValue {
    serde_wasm_bindgen::to_value(&[TimingProfileId::Ufba2025.as_str()])
        .expect("serialize supported timing profiles")
}
