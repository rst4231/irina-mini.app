import { DEFAULT_RUNTIME_CONFIG } from './runtime-config.js';

export function getApplicationViewState({ completed, approved, receivedTerms, config = DEFAULT_RUNTIME_CONFIG }) {
  const copy = config?.copy?.application || DEFAULT_RUNTIME_CONFIG.copy.application;
  const links = config?.links || DEFAULT_RUNTIME_CONFIG.links;

  if (approved && receivedTerms) {
    return {
      status: copy.terms.status,
      description: copy.terms.description,
      icon: 'terms',
      tone: 'terms',
      action: {
        label: copy.terms.button,
        url: links.viewTerms,
        target: '_blank',
      },
    };
  }

  if (approved) {
    return {
      status: copy.approved.status,
      description: copy.approved.description,
      icon: 'approved',
      tone: 'approved',
      action: {
        label: copy.approved.button,
        url: links.discussTerms,
        hint: copy.approved.hint,
        closeMiniApp: true,
      },
    };
  }

  if (completed) {
    return {
      status: copy.complete.status,
      description: copy.complete.description,
      icon: 'pending',
      tone: 'complete',
      action: null,
    };
  }

  return {
    status: copy.incomplete.status,
    description: copy.incomplete.description,
    icon: 'form',
    tone: 'incomplete',
    action: {
      label: copy.incomplete.button,
      url: links.fillApplication,
      hint: copy.incomplete.hint,
      closeMiniApp: true,
    },
  };
}
