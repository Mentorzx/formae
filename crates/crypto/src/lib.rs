use formae_domain::TimingProfileId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LocalVaultAlgorithm {
    Aes256Gcm,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WipeMode {
    MemoryOnly,
    FullDevicePurge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedSnapshotEnvelope {
    pub schema_version: u16,
    pub algorithm: LocalVaultAlgorithm,
    pub profile_id: TimingProfileId,
    pub salt_b64: String,
    pub nonce_b64: String,
    pub ciphertext_b64: String,
    pub aad_context: String,
}

pub fn build_aad_context(student_number: &str, profile_id: TimingProfileId) -> String {
    format!("formae:{student_number}:{}", profile_id.as_str())
}
