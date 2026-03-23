use core::fmt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimingProfileId {
    Ufba2025,
}

impl TimingProfileId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ufba2025 => "Ufba2025",
        }
    }
}

impl fmt::Display for TimingProfileId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str((*self).as_str())
    }
}

impl TryFrom<&str> for TimingProfileId {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "Ufba2025" => Ok(Self::Ufba2025),
            other => Err(format!("Unsupported timing profile: {other}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Weekday {
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday,
    Saturday,
}

impl Weekday {
    pub fn from_sigaa_digit(digit: char) -> Option<Self> {
        match digit {
            '2' => Some(Self::Monday),
            '3' => Some(Self::Tuesday),
            '4' => Some(Self::Wednesday),
            '5' => Some(Self::Thursday),
            '6' => Some(Self::Friday),
            '7' => Some(Self::Saturday),
            _ => None,
        }
    }

    pub fn sigaa_digit(self) -> char {
        match self {
            Self::Monday => '2',
            Self::Tuesday => '3',
            Self::Wednesday => '4',
            Self::Thursday => '5',
            Self::Friday => '6',
            Self::Saturday => '7',
        }
    }

    pub fn display_name_pt_br(self) -> &'static str {
        match self {
            Self::Monday => "Segunda",
            Self::Tuesday => "Terca",
            Self::Wednesday => "Quarta",
            Self::Thursday => "Quinta",
            Self::Friday => "Sexta",
            Self::Saturday => "Sabado",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TurnCode {
    Morning,
    Afternoon,
    Night,
}

impl TurnCode {
    pub fn from_sigaa_code(code: char) -> Option<Self> {
        match code {
            'M' => Some(Self::Morning),
            'T' => Some(Self::Afternoon),
            'N' => Some(Self::Night),
            _ => None,
        }
    }

    pub fn sigaa_code(self) -> char {
        match self {
            Self::Morning => 'M',
            Self::Afternoon => 'T',
            Self::Night => 'N',
        }
    }

    pub fn max_slot(self) -> u8 {
        match self {
            Self::Morning | Self::Afternoon => 6,
            Self::Night => 4,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClockTime {
    pub hour: u8,
    pub minute: u8,
}

impl ClockTime {
    pub const fn new(hour: u8, minute: u8) -> Self {
        Self { hour, minute }
    }
}

impl fmt::Display for ClockTime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:02}:{:02}", self.hour, self.minute)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SlotBoundary {
    pub profile_id: TimingProfileId,
    pub turn: TurnCode,
    pub slot: u8,
    pub start: ClockTime,
    pub end: ClockTime,
}

const UFBA_2025_SLOTS: [SlotBoundary; 16] = [
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Morning,
        slot: 1,
        start: ClockTime::new(7, 0),
        end: ClockTime::new(7, 55),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Morning,
        slot: 2,
        start: ClockTime::new(7, 55),
        end: ClockTime::new(8, 50),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Morning,
        slot: 3,
        start: ClockTime::new(8, 50),
        end: ClockTime::new(9, 45),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Morning,
        slot: 4,
        start: ClockTime::new(9, 45),
        end: ClockTime::new(10, 40),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Morning,
        slot: 5,
        start: ClockTime::new(10, 40),
        end: ClockTime::new(11, 35),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Morning,
        slot: 6,
        start: ClockTime::new(11, 35),
        end: ClockTime::new(12, 30),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Afternoon,
        slot: 1,
        start: ClockTime::new(13, 0),
        end: ClockTime::new(13, 55),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Afternoon,
        slot: 2,
        start: ClockTime::new(13, 55),
        end: ClockTime::new(14, 50),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Afternoon,
        slot: 3,
        start: ClockTime::new(14, 50),
        end: ClockTime::new(15, 45),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Afternoon,
        slot: 4,
        start: ClockTime::new(15, 45),
        end: ClockTime::new(16, 40),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Afternoon,
        slot: 5,
        start: ClockTime::new(16, 40),
        end: ClockTime::new(17, 35),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Afternoon,
        slot: 6,
        start: ClockTime::new(17, 35),
        end: ClockTime::new(18, 30),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Night,
        slot: 1,
        start: ClockTime::new(18, 30),
        end: ClockTime::new(19, 25),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Night,
        slot: 2,
        start: ClockTime::new(19, 25),
        end: ClockTime::new(20, 20),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Night,
        slot: 3,
        start: ClockTime::new(20, 20),
        end: ClockTime::new(21, 15),
    },
    SlotBoundary {
        profile_id: TimingProfileId::Ufba2025,
        turn: TurnCode::Night,
        slot: 4,
        start: ClockTime::new(21, 15),
        end: ClockTime::new(22, 10),
    },
];

pub fn lookup_slot(profile_id: TimingProfileId, turn: TurnCode, slot: u8) -> Option<SlotBoundary> {
    UFBA_2025_SLOTS.iter().copied().find(|candidate| {
        candidate.profile_id == profile_id && candidate.turn == turn && candidate.slot == slot
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meeting {
    pub day: Weekday,
    pub turn: TurnCode,
    pub slot_start: u8,
    pub slot_end: u8,
    pub start_time: ClockTime,
    pub end_time: ClockTime,
    pub source_segment: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleBlock {
    pub component_code: Option<String>,
    pub raw_code: String,
    pub canonical_code: String,
    pub meetings: Vec<Meeting>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScheduleParseWarningCode {
    EmptyInput,
    NormalizedWhitespace,
    NormalizedCase,
    CanonicalizedSegment,
    ReorderedSegments,
    DeduplicatedDays,
    DeduplicatedSlots,
    UnparsedToken,
    OutOfRangeSlot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleParseWarning {
    pub code: ScheduleParseWarningCode,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleParseResult {
    pub raw_code: String,
    pub normalized_code: String,
    pub canonical_code: String,
    pub meetings: Vec<Meeting>,
    pub warnings: Vec<ScheduleParseWarning>,
    pub profile_id: TimingProfileId,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub code: String,
    pub name: String,
    pub campus: String,
    pub degree_level: String,
    pub total_workload_hours: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Component {
    pub code: String,
    pub title: String,
    pub credits: u8,
    pub workload_hours: u16,
    pub component_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrerequisiteRule {
    pub component_code: String,
    pub expression: String,
    pub required_component_codes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Equivalence {
    pub source_component_code: String,
    pub equivalent_component_code: String,
    pub rationale: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PendingRequirementStatus {
    Outstanding,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingRequirement {
    pub id: String,
    pub title: String,
    pub status: PendingRequirementStatus,
    pub details: String,
    pub related_component_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedDocumentMetadata {
    pub kind: String,
    pub authenticity_code: String,
    pub issued_at: String,
    pub local_file_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumStructure {
    pub curriculum_id: String,
    pub name: String,
    pub course: Course,
    pub components: Vec<Component>,
    pub prerequisite_rules: Vec<PrerequisiteRule>,
    pub equivalences: Vec<Equivalence>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentSnapshot {
    pub schema_version: u16,
    pub generated_at: String,
    pub student_number: String,
    pub student_name: String,
    pub curriculum: CurriculumStructure,
    pub completed_components: Vec<Component>,
    pub in_progress_components: Vec<Component>,
    pub schedule_blocks: Vec<ScheduleBlock>,
    pub pending_requirements: Vec<PendingRequirement>,
    pub issued_documents: Vec<IssuedDocumentMetadata>,
}
