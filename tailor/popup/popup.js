// ---- SCREEN MANAGEMENT ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function showError(msg) {
  document.getElementById('error-text').textContent = msg;
  showScreen('error');
}

// ---- STORAGE HELPERS ----
async function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  const data = await getStorage(['apiKey', 'linkedinUrl', 'masterCV']);

  if (!data.apiKey || !data.linkedinUrl) {
    showScreen('setup');
    return;
  }

  // Check if we're on a LinkedIn job page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isJobPage = tab.url && tab.url.includes('linkedin.com/jobs/');

  showScreen('main');


  if (isJobPage) {
    // Scrape job details directly via executeScript (no message passing needed)
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Parse document.title — format: "Job Title | Company | LinkedIn"
          const parts = document.title.split(' | ');
          const title = parts.length >= 2 ? parts[0].trim() : '';
          const company = parts.length >= 3 ? parts[1].trim() : '';

          // Get job description from the page body
          const descEl = document.querySelector('#job-details') ||
                         document.querySelector('.jobs-description-content__text') ||
                         document.querySelector('.jobs-description__content') ||
                         document.querySelector('.jobs-box__html-content');
          let description = descEl ? descEl.innerText.trim() : '';

          // Fallback: extract description from body text
          if (!description) {
            const bodyText = document.body.innerText;
            const aboutIdx = bodyText.indexOf('About the job');
            if (aboutIdx !== -1) {
              description = bodyText.substring(aboutIdx, aboutIdx + 5000).trim();
            } else {
              // Use a chunk of the page text as context
              description = bodyText.substring(0, 5000).trim();
            }
          }

          return title ? { title, company, description } : null;
        }
      });
      const response = results && results[0] && results[0].result;
      if (response && response.title) {
        document.getElementById('job-title-display').textContent = response.title;
        document.getElementById('job-company-display').textContent = response.company || '';
        document.getElementById('btn-tailor').disabled = false;
        window.currentJob = response;
      } else {
        document.getElementById('job-detected').classList.add('hidden');
        document.getElementById('no-job').classList.remove('hidden');
      }
    } catch (e) {
      document.getElementById('job-detected').classList.add('hidden');
      document.getElementById('no-job').classList.remove('hidden');
    }
  } else {
    document.getElementById('job-detected').classList.add('hidden');
    document.getElementById('no-job').classList.remove('hidden');
  }

  // Store master CV reference
  window.masterCV = data.masterCV;
  window.apiKey = data.apiKey;
});

// ---- SETUP ----
document.getElementById('btn-save-setup').addEventListener('click', async () => {
  const url = document.getElementById('linkedin-url').value.trim();
  const key = document.getElementById('api-key').value.trim();

  if (!url || !key) {
    alert('Please fill in both fields.');
    return;
  }

  let cleanUrl = url.includes('linkedin.com') ? url : 'https://www.linkedin.com/in/' + url;
  // Ensure https://www. prefix so it matches host_permissions
  cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, 'https://www.');

  await setStorage({ linkedinUrl: cleanUrl, apiKey: key });

  showScreen('loading-profile');

  // Scrape LinkedIn profile
  try {
    const tab = await openLinkedInProfile(cleanUrl);
    await sleep(3000); // Let page load

    // Inject content script on profile page (it only auto-loads on /jobs/*)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });

    const profile = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PROFILE' });
    await chrome.tabs.remove(tab.id);

    if (!profile || !profile.text) throw new Error('Could not read profile. Make sure you are logged in to LinkedIn.');

    await setStorage({ masterCV: profile.text });
    window.masterCV = profile.text;
    window.apiKey = key;

    showScreen('main');
    document.getElementById('job-detected').classList.add('hidden');
    document.getElementById('no-job').classList.remove('hidden');

  } catch (e) {
    showError('Could not load your LinkedIn profile: ' + e.message + '\n\nMake sure you are logged into LinkedIn in this browser.');
  }
});

async function openLinkedInProfile(url) {
  return new Promise(resolve => {
    chrome.tabs.create({ url, active: false }, tab => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Get the tab again to capture the final URL after redirects
          chrome.tabs.get(tab.id, updatedTab => resolve(updatedTab));
        }
      });
    });
  });
}

// ---- TAILOR ----
document.getElementById('btn-tailor').addEventListener('click', async () => {
  showScreen('generating');

  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  let currentStep = 0;

  function activateStep(i) {
    if (i > 0) {
      document.getElementById(steps[i-1]).classList.remove('active');
      document.getElementById(steps[i-1]).classList.add('done');
    }
    if (i < steps.length) {
      document.getElementById(steps[i]).classList.add('active');
    }
    currentStep = i;
  }

  activateStep(0);

  try {
    const data = await getStorage(['apiKey', 'masterCV']);
    const apiKey = data.apiKey;
    const masterCV = data.masterCV;
    const job = window.currentJob;

    if (!masterCV) throw new Error('Master CV not found. Please set up again.');
    if (!job) throw new Error('No job details found.');

    // Step 1 done, step 2+3: Generate CV and cover letter in parallel
    await sleep(400);
    activateStep(1);

    const cvPrompt = `You are an expert CV writer. Given a candidate's LinkedIn profile and a job description, rewrite the CV to be perfectly tailored for this specific role.

CANDIDATE PROFILE:
${masterCV}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

Write a tailored, professional CV in plain text format. Focus on relevant experience, use keywords from the job description, and highlight the most relevant achievements. Use clear sections: PROFESSIONAL SUMMARY, EXPERIENCE, SKILLS, EDUCATION. Keep it concise and impactful.`;

    const coverPrompt = `You are an expert cover letter writer. Write a compelling, personalised cover letter for this job application.

CANDIDATE PROFILE:
${masterCV}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

Write a 3-paragraph cover letter that:
1. Opens with a strong hook showing genuine interest in this specific role and company
2. Highlights 2-3 most relevant experiences/achievements that match the job requirements
3. Closes with confidence and a clear call to action

Keep it under 350 words. Do not use clichés. Sound like a real human, not an AI.`;

    // Run both API calls in parallel
    const [cvText, coverText] = await Promise.all([
      callClaude(apiKey, cvPrompt),
      callClaude(apiKey, coverPrompt).then(result => { activateStep(2); return result; })
    ]);

    // Step 4: Prepare
    activateStep(3);
    await sleep(300);

    // Store results
    window.generatedCV = cvText;
    window.generatedCover = coverText;

    // Show results
    document.getElementById('cv-output').value = cvText;
    document.getElementById('cover-output').value = coverText;

    showScreen('results');

  } catch (e) {
    showError(e.message);
  }
});

// ---- CLAUDE API ----
async function callClaude(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'LLM API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

// ---- TABS ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ---- DOWNLOAD ----
document.getElementById('btn-download-cv').addEventListener('click', () => {
  const job = window.currentJob;
  const company = job && job.company ? job.company.replace(/[^a-zA-Z0-9]/g, '-') : 'job';
  downloadFormatted(window.generatedCV, `CV-${company}.html`, 'Tailored CV');
});

document.getElementById('btn-download-cover').addEventListener('click', () => {
  const job = window.currentJob;
  const company = job && job.company ? job.company.replace(/[^a-zA-Z0-9]/g, '-') : 'job';
  downloadFormatted(window.generatedCover, `Cover-Letter-${company}.html`, 'Cover Letter');
});

function markdownToHtml(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hulo]|<li|<hr)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function downloadFormatted(text, filename, title) {
  const bodyHtml = markdownToHtml(text);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Lora:wght@400;600&display=swap');
  body { font-family: 'Inter', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.6; font-size: 14px; }
  h1 { font-family: 'Lora', serif; font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 24px 0 12px; }
  h3 { font-size: 15px; margin: 16px 0 4px; }
  p { margin: 0 0 8px; }
  ul { margin: 4px 0 12px; padding-left: 20px; }
  li { margin: 2px 0; }
  strong { font-weight: 600; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  @media print { body { margin: 0; padding: 20px; } }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- BACK / SETTINGS ----
document.getElementById('btn-back').addEventListener('click', () => showScreen('main'));
document.getElementById('btn-error-back').addEventListener('click', () => showScreen('main'));
document.getElementById('btn-settings').addEventListener('click', async () => {
  await setStorage({ apiKey: null, linkedinUrl: null, masterCV: null });
  showScreen('setup');
});

// ---- UTILS ----
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
