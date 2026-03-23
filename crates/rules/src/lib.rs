use formae_domain::{PendingRequirement, PendingRequirementStatus, StudentSnapshot};
use std::collections::BTreeSet;

pub fn derive_pending_requirements(snapshot: &StudentSnapshot) -> Vec<PendingRequirement> {
    let completed_codes: BTreeSet<&str> = snapshot
        .completed_components
        .iter()
        .map(|component| component.code.as_str())
        .collect();
    let in_progress_codes: BTreeSet<&str> = snapshot
        .in_progress_components
        .iter()
        .map(|component| component.code.as_str())
        .collect();

    let mut derived = snapshot.pending_requirements.clone();

    for component in &snapshot.curriculum.components {
        let is_pending = !completed_codes.contains(component.code.as_str())
            && !in_progress_codes.contains(component.code.as_str());

        if is_pending {
            derived.push(PendingRequirement {
                id: format!("component:{}", component.code),
                title: format!("Concluir {}", component.title),
                status: PendingRequirementStatus::Outstanding,
                details: format!(
                    "Componente ainda nao concluido nem em andamento: {}",
                    component.code
                ),
                related_component_code: Some(component.code.clone()),
            });
        }
    }

    derived
}
