export function getApplicationViewState({ completed, approved, receivedTerms }) {
  if (approved && receivedTerms) {
    return {
      status: 'Условия готовы',
      icon: 'terms',
      tone: 'terms',
      action: {
        label: 'Посмотреть условия',
        url: 'https://buildin.ai/arbstart/share/292c0b0f-8ae4-483a-89f7-4892ed10b70f',
        target: '_blank',
      },
    };
  }

  if (approved) {
    return {
      status: 'Анкета одобрена',
      icon: 'approved',
      tone: 'approved',
      action: {
        label: 'Обсудить условия',
        url: 'https://t.me/rstshelp_bot?start=6a3d21d4694618648d009d8d',
        hint: 'Займет 10–15 минут',
        closeMiniApp: true,
      },
    };
  }

  if (completed) {
    return {
      status: 'Анкета заполнена',
      icon: 'pending',
      tone: 'complete',
      action: null,
    };
  }

  return {
    status: 'Анкета не заполнена',
    icon: 'form',
    tone: 'incomplete',
    action: {
      label: 'Заполнить анкету',
      url: 'https://t.me/rstshelp_bot?start=69de0afdde3f2d88240a95e8',
      hint: 'Займет пару минут',
      closeMiniApp: true,
    },
  };
}
