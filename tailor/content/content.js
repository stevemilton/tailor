// Content script runs on linkedin.com/jobs/*

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'GET_PROFILE') {
    const profile = scrapeProfile();
    sendResponse(profile);
    return true;
  }

});

// ---- SCRAPE PROFILE ----
function scrapeProfile() {
  try {
    const sections = [];

    // Name
    const nameEl = document.querySelector('.text-heading-xlarge') ||
                   document.querySelector('h1.inline') ||
                   document.querySelector('h1');
    if (nameEl) sections.push('NAME: ' + nameEl.innerText.trim());

    // Headline
    const headlineEl = document.querySelector('.text-body-medium.break-words') ||
                       document.querySelector('.pv-text-details__left-panel .text-body-medium');
    if (headlineEl) sections.push('HEADLINE: ' + headlineEl.innerText.trim());

    // About
    const aboutEl = document.querySelector('#about ~ .pvs-list__outer-container') ||
                    document.querySelector('[data-generated-suggestion-target="about"] .pv-shared-text-with-see-more');
    if (aboutEl) sections.push('ABOUT:\n' + aboutEl.innerText.trim());

    // Experience
    const expSection = document.querySelector('#experience');
    if (expSection) {
      const expContainer = expSection.closest('section') ||
                           expSection.parentElement?.parentElement;
      if (expContainer) {
        sections.push('EXPERIENCE:\n' + expContainer.innerText.replace('Experience', '').trim());
      }
    }

    // Education
    const eduSection = document.querySelector('#education');
    if (eduSection) {
      const eduContainer = eduSection.closest('section') ||
                           eduSection.parentElement?.parentElement;
      if (eduContainer) {
        sections.push('EDUCATION:\n' + eduContainer.innerText.replace('Education', '').trim());
      }
    }

    // Skills
    const skillsSection = document.querySelector('#skills');
    if (skillsSection) {
      const skillsContainer = skillsSection.closest('section') ||
                              skillsSection.parentElement?.parentElement;
      if (skillsContainer) {
        sections.push('SKILLS:\n' + skillsContainer.innerText.replace('Skills', '').trim());
      }
    }

    // Fallback - just grab all visible text
    if (sections.length < 2) {
      const main = document.querySelector('main') || document.body;
      return { text: main.innerText.substring(0, 8000) };
    }

    return { text: sections.join('\n\n') };
  } catch (e) {
    return { text: document.body.innerText.substring(0, 8000) };
  }
}
