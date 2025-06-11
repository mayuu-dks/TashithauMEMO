
import { themes } from './themes.js';
import { extractAndSumNumbers } from './utils/numberExtractor.js';

console.log("script.js loaded and executing");

const LOCAL_STORAGE_KEY_TABS = 'memoAppTabsData_v1_static';
const LOCAL_STORAGE_KEY_THEME = 'memoAppTheme_v1_static';
const CALCULATION_DEBOUNCE_MS = 300;
const MAX_TABS = 10;

let tabs = [];
let activeTabId = null;
let currentThemeId = 'earth'; // Default theme
let isLoading = false;
let calculationTimeoutId = null;

// DOM Elements - declared here for broader scope if needed, assigned in initApp
let themeSelect, appDescription, tabsListContainer, mainContentArea;

// --- Helper Functions ---
const sanitizeFilename = (name) => {
  if (!name) return 'untitled_memo';
  let sanitized = name.replace(/[\s/\\?%*:|"<>.()［］¥]/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '').replace(/__+/g, '_');
  sanitized = sanitized.substring(0, 50);
  return sanitized || 'memo';
};

const generateDefaultTabTitle = (currentTabs, forTabId) => {
  if (forTabId) {
    const tabIndex = currentTabs.findIndex(tab => tab.id === forTabId);
    if (tabIndex !== -1) return `メモ ${tabIndex + 1}`;
    return `メモ ${currentTabs.length + 1}`;
  }
  return `メモ ${currentTabs.length + 1}`;
};

const toKebabCase = (str) => {
  let result = str.replace(/([A-Z])/g, (match, _letter, offset) => {
    return offset > 0 ? `-${match}` : match;
  });
  result = result.replace(/([a-zA-Z])([0-9])/g, '$1-$2');
  return result.toLowerCase();
};

const applyThemeToDocument = (themeId) => {
  const selectedTheme = themes.find(t => t.id === themeId);
  const earthTheme = themes.find(t => t.id === 'earth');
  const firstTheme = themes.length > 0 ? themes[0] : null;
  const themeToApply = selectedTheme || earthTheme || firstTheme;

  if (!themeToApply) {
    console.error("Fatal: No theme available to apply.");
    document.body.style.backgroundColor = "#ffffff";
    document.body.style.color = "#000000";
    return;
  }

  if (!selectedTheme) {
    console.warn(`Theme with id "${themeId}" not found. Applying default theme "${themeToApply.name}".`);
  }

  if (themeToApply.colors && typeof themeToApply.colors === 'object') {
    Object.entries(themeToApply.colors).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const kebabCaseKey = toKebabCase(key);
        const cssVarName = `--color-${kebabCaseKey}`;
        document.documentElement.style.setProperty(cssVarName, value);
      }
    });
    if (typeof themeToApply.colors.lightBg === 'string') {
      document.body.style.backgroundColor = themeToApply.colors.lightBg;
    } else {
      document.body.style.backgroundColor = earthTheme?.colors?.lightBg || firstTheme?.colors?.lightBg || "#eadfca";
    }
  } else {
    console.error(`Colors object missing for theme "${themeToApply.name}".`);
    document.body.style.backgroundColor = earthTheme?.colors?.lightBg || firstTheme?.colors?.lightBg || "#eadfca";
  }
};

const saveStateToLocalStorage = () => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_TABS, JSON.stringify({ tabs, activeTabId }));
    localStorage.setItem(LOCAL_STORAGE_KEY_THEME, currentThemeId);
  } catch (error) {
    console.error("Failed to save state to localStorage:", error);
  }
};

const loadStateFromLocalStorage = () => {
  console.log("loadStateFromLocalStorage started");
  try {
    const storedTheme = localStorage.getItem(LOCAL_STORAGE_KEY_THEME);
    if (storedTheme && themes.some(t => t.id === storedTheme)) {
      currentThemeId = storedTheme;
    } else {
      currentThemeId = themes.find(t => t.id === 'earth')?.id || themes[0]?.id || 'original';
    }

    const storedTabsData = localStorage.getItem(LOCAL_STORAGE_KEY_TABS);
    if (storedTabsData) {
      const parsedData = JSON.parse(storedTabsData);
      if (parsedData.tabs && parsedData.tabs.length > 0) {
        tabs = parsedData.tabs.slice(0, MAX_TABS);
        activeTabId = (parsedData.activeTabId && tabs.some(t => t.id === parsedData.activeTabId))
          ? parsedData.activeTabId
          : tabs[0].id;
      } else {
        console.log("No tabs in localStorage or empty tabs array, adding initial tab.");
        addNewTab(true); 
      }
    } else {
      console.log("No tabs data in localStorage, adding initial tab.");
      addNewTab(true); 
    }
  } catch (error) {
    console.error("Failed to load state from localStorage:", error);
    tabs = []; 
    activeTabId = null;
    addNewTab(true); 
  }
  console.log("loadStateFromLocalStorage completed. ActiveTabID:", activeTabId, "Tabs count:", tabs.length);
};


// --- Rendering Functions ---

const renderThemeSelector = () => {
  if (!themeSelect) return;
  themeSelect.innerHTML = ''; 
  themes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    option.className = "bg-[var(--color-content)] text-[var(--color-dark-text)]";
    themeSelect.appendChild(option);
  });
  themeSelect.value = currentThemeId;
};

const renderTabBar = () => {
  if (!tabsListContainer) return;
  tabsListContainer.innerHTML = ''; 
  tabs.forEach(tab => {
    const tabDiv = document.createElement('div');
    tabDiv.dataset.tabId = tab.id;
    tabDiv.className = `flex items-center justify-between pl-3 pr-1 py-2 rounded-t-md cursor-pointer min-w-[120px] max-w-[200px] border-b-2 transition-all duration-150 ease-in-out group
                        ${activeTabId === tab.id
                          ? 'bg-[var(--color-content)] border-[var(--color-primary)]'
                          : 'bg-[var(--color-slate-100)] hover:bg-[var(--color-slate-50)] border-transparent hover:border-[var(--color-primary)]'
                        }`;
    tabDiv.title = `${tab.title}${activeTabId === tab.id ? " (アクティブ)" : ""}\nダブルクリックでタイトル編集`;

    const titleSpan = document.createElement('span');
    titleSpan.className = "text-sm truncate overflow-hidden flex-grow text-[var(--color-primary)]";
    titleSpan.textContent = tab.title;

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = "w-full text-sm p-0 m-0 border-none outline-none bg-transparent focus:ring-0 text-[var(--color-primary)] hidden";
    inputField.maxLength = 30;

    tabDiv.appendChild(inputField);
    tabDiv.appendChild(titleSpan);
    
    tabDiv.addEventListener('click', () => selectTab(tab.id));
    tabDiv.addEventListener('dblclick', () => startEditTabTitle(tab.id, tabDiv, titleSpan, inputField));

    const closeButton = document.createElement('button');
    closeButton.className = `ml-2 p-0.5 rounded-full hover:bg-[var(--color-red-200)] text-[var(--color-slate-500)] hover:text-[var(--color-red-600)] transition-colors
                             ${activeTabId === tab.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`;
    closeButton.setAttribute('aria-label', `タブ「${tab.title}」を閉じる`);
    closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" class="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    tabDiv.appendChild(closeButton);
    tabsListContainer.appendChild(tabDiv);

    if (tab.id === activeTabId) {
        setTimeout(() => tabDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }), 0);
    }
  });

  const addTabButton = document.createElement('button');
  addTabButton.id = 'add-tab-button';
  addTabButton.className = "ml-2 p-2 rounded-full bg-[var(--color-content)] text-[var(--color-primary)] hover:bg-[var(--color-slate-100)] transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";
  addTabButton.setAttribute('aria-label', "新しいメモタブを追加");
  addTabButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" class="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
  addTabButton.disabled = tabs.length >= MAX_TABS;
  addTabButton.title = addTabButton.disabled ? `タブは最大${MAX_TABS}個までです` : "新しいメモタブを追加";
  addTabButton.addEventListener('click', () => addNewTab());
  tabsListContainer.appendChild(addTabButton);
};

const startEditTabTitle = (tabId, tabDiv, titleSpan, inputField) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    titleSpan.classList.add('hidden');
    inputField.classList.remove('hidden');
    inputField.value = tab.title;
    inputField.focus();
    inputField.select();

    const finishEdit = () => {
        const newTitle = inputField.value.trim();
        updateTabTitle(tabId, newTitle); 
        inputField.classList.add('hidden');
        titleSpan.classList.remove('hidden');
    };

    inputField.onblur = finishEdit;
    inputField.onkeydown = (e) => {
        if (e.key === 'Enter') {
            inputField.blur(); 
        } else if (e.key === 'Escape') {
            inputField.value = tab.title; 
            inputField.blur(); 
        }
    };
};


const renderMemoArea = () => {
  if (!mainContentArea) return;
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  console.log("renderMemoArea called. Active tab:", activeTab);

  if (!activeTab) {
    mainContentArea.innerHTML = `
      <div class="text-center py-10">
        <p class="text-xl text-[var(--color-slate-500)]">タブがありません。新しいタブを作成してください。</p>
        <button id="create-first-tab-button" class="mt-4 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-blue-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-50 transition-colors ${tabs.length >= MAX_TABS ? "disabled:opacity-50 disabled:cursor-not-allowed" : ""}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" class="w-5 h-5 inline-block mr-2 align-text-bottom"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          新しいメモタブを作成
        </button>
      </div>`;
    const createFirstTabButton = document.getElementById('create-first-tab-button');
    if (createFirstTabButton) {
        if (tabs.length < MAX_TABS) {
            createFirstTabButton.addEventListener('click', () => addNewTab());
        } else {
            createFirstTabButton.disabled = true;
        }
    }
    return;
  }

  const placeholderText = `【このアプリの記入ルール】\n・書き込んだ数字が自動で検出されて合計されます。\n・（）で囲まれた内容は計算から除外されます。\n・四則演算（+, -, ×, ÷）の式は計算結果が合計に加算されます。\n  例: 2+3×4 → 2+12 → 14\n・[ ] または ［ ］ で囲まれた項目は、その中でまず計算・合計され、その結果が全体の計算に使用されます。\n  例: [りんご 50円 バナナ 30×2個] → [50円 60個] → 110\n・「数値 演算子 数値 = 答え」の形式（例: 60+7=67）は、答えの数値（67）のみが計算対象になります。\n・メモのタイトル（タブの名前）はダブルクリックで編集できます。`;

  mainContentArea.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="bg-[var(--color-content)] p-6 rounded-xl flex flex-col">
        <div class="flex flex-col space-y-3 h-full">
          <div class="flex items-center justify-between">
            <label for="memo-text-area" class="font-app-title text-lg font-semibold text-[var(--color-primary)]">メモ入力</label>
            <div class="flex items-center space-x-2">
              <button id="clear-memo-button" class="px-3 py-1.5 bg-[var(--color-orange-500)] text-white text-xs rounded-md hover:bg-[var(--color-orange-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-orange-500)] focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center" aria-label="現在のタブのメモをクリアする" title="入力をクリア">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" class="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L6.75 15m5.25-5.25L17.25 15M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                クリア
              </button>
              <button id="download-memo-button" class="px-3 py-1.5 bg-[var(--color-green-500)] text-white text-xs rounded-md hover:bg-[var(--color-green-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-green-500)] focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center" aria-label="現在のメモをテキストファイルとしてダウンロード" title="テキストとしてダウンロード">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" class="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                保存
              </button>
            </div>
          </div>
          <textarea id="memo-text-area" placeholder="${placeholderText}" class="themed-scrollbar flex-grow w-full p-4 border border-[var(--color-slate-300)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-shadow duration-200 resize-none text-base text-[var(--color-slate-500)] bg-[var(--color-slate-50)] min-h-[200px] md:min-h-[calc(100%-40px-0.75rem)]" rows="10"></textarea>
        </div>
      </div>
      <div id="results-display-container" class="bg-[var(--color-content)] p-6 rounded-xl flex flex-col">
        <!-- Results display will be rendered here -->
      </div>
    </div>`;

  const memoTextArea = document.getElementById('memo-text-area');
  memoTextArea.value = activeTab.memoText;
  memoTextArea.addEventListener('input', handleMemoChange);

  const clearMemoButton = document.getElementById('clear-memo-button');
  clearMemoButton.disabled = !activeTab.memoText.trim();
  clearMemoButton.addEventListener('click', handleClearMemo);

  const downloadMemoButton = document.getElementById('download-memo-button');
  downloadMemoButton.disabled = !activeTab.memoText.trim();
  downloadMemoButton.addEventListener('click', handleDownloadMemo);
  
  renderResultsDisplay(); 
};

const renderResultsDisplay = () => {
  const resultsContainer = document.getElementById('results-display-container');
  if (!resultsContainer) return;

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const numbers = activeTab ? activeTab.extractedData.numbers : [];
  const sum = activeTab ? activeTab.extractedData.sum : 0;

  let numbersHtml = '';
  if (isLoading) {
    numbersHtml = `
      <div class="animate-pulse space-y-2">
        <div class="h-4 bg-[var(--color-slate-200)] rounded w-3/4"></div>
        <div class="h-4 bg-[var(--color-slate-200)] rounded w-1/2"></div>
      </div>`;
  } else if (numbers.length > 0) {
    numbersHtml = `
      <div class="max-h-60 overflow-y-auto p-3 bg-[var(--color-slate-50)] rounded-md border border-[var(--color-slate-200)] flex flex-wrap gap-2 themed-scrollbar">
        ${numbers.map(num => `<span class="inline-block bg-[var(--color-blue-100)] text-[var(--color-blue-700)] text-sm font-medium px-3 py-1 rounded-full">${num.toLocaleString()}</span>`).join('')}
      </div>`;
  } else {
    numbersHtml = `<p class="text-[var(--color-medium-text)] italic">数字は見つかりませんでした。</p>`;
  }

  let sumHtml = '';
  if (isLoading) {
    sumHtml = `<div class="animate-pulse h-10 bg-[var(--color-slate-200)] rounded w-1/4"></div>`;
  } else {
    sumHtml = `<p class="text-4xl font-bold text-[var(--color-primary)]">${sum.toLocaleString()}</p>`;
  }

  resultsContainer.innerHTML = `
    <div class="space-y-6 h-full flex flex-col">
      <div>
        <h2 class="font-app-title text-lg font-semibold text-[var(--color-primary)] mb-1">検出された数字</h2>
        <p class="text-xs text-[var(--color-slate-500)] mb-3">(角括弧 [] 内は合計値、四則演算 (+, -, ×, ÷) は計算済みの値です)</p>
        ${numbersHtml}
      </div>
      <div class="mt-auto pt-6 border-t border-[var(--color-slate-200)]">
        <h2 class="font-app-title text-lg font-semibold text-[var(--color-primary)] mb-2">合計</h2>
        ${sumHtml}
      </div>
    </div>`;
};

const renderAll = () => {
  console.log("renderAll started");
  applyThemeToDocument(currentThemeId); 
  renderThemeSelector(); 
  renderTabBar();
  renderMemoArea();
  if (appDescription) {
    appDescription.innerHTML = `メモの文中の数字を自動で加算していくアプリです。<br />最大${MAX_TABS}ページのメモをタブで管理できます。`;
  } else {
    console.warn("App description element (app-description) not found during renderAll.");
  }
  console.log("renderAll completed");
};

// --- Event Handlers & Logic ---
const handleMemoChange = (event) => {
  if (activeTabId === null) return;
  const newText = event.target.value;
  const tabIndex = tabs.findIndex(t => t.id === activeTabId);
  if (tabIndex === -1) return;

  tabs[tabIndex].memoText = newText;
  
  const clearMemoButton = document.getElementById('clear-memo-button');
  if (clearMemoButton) clearMemoButton.disabled = !newText.trim();
  const downloadMemoButton = document.getElementById('download-memo-button');
  if (downloadMemoButton) downloadMemoButton.disabled = !newText.trim();

  isLoading = true;
  renderResultsDisplay(); 

  if (calculationTimeoutId) {
    clearTimeout(calculationTimeoutId);
  }

  calculationTimeoutId = setTimeout(() => {
    const results = extractAndSumNumbers(newText);
    tabs[tabIndex].extractedData = results;
    isLoading = false;
    renderResultsDisplay(); 
    saveStateToLocalStorage();
  }, CALCULATION_DEBOUNCE_MS);
};

const addNewTab = (isInitial = false) => {
  console.log(`addNewTab called. isInitial: ${isInitial}, current tabs count: ${tabs.length}`);
  if (!isInitial && tabs.length >= MAX_TABS) {
    alert(`タブは最大${MAX_TABS}個までです。`);
    return;
  }
  const newTabId = crypto.randomUUID();
  const newTab = {
    id: newTabId,
    title: generateDefaultTabTitle(tabs),
    memoText: '',
    extractedData: { numbers: [], sum: 0 },
    createdAt: Date.now(),
  };
  tabs.push(newTab);
  activeTabId = newTabId;
  console.log(`New tab added. ID: ${newTabId}, Total tabs: ${tabs.length}, ActiveTabID: ${activeTabId}`);
  
  if (!isInitial) { 
     saveStateToLocalStorage();
     renderAll(); // Full render for non-initial tab add
  }
  // For initial tab, renderAll will be called later in initApp
};

const selectTab = (tabId) => {
  if (activeTabId === tabId) return;
  activeTabId = tabId;
  saveStateToLocalStorage();
  renderAll();
};

const closeTab = (tabIdToClose) => {
  const tabIndexToClose = tabs.findIndex(tab => tab.id === tabIdToClose);
  if (tabIndexToClose === -1) return;

  tabs.splice(tabIndexToClose, 1);

  if (tabs.length === 0) {
    addNewTab(false); // Add new tab, will trigger renderAll and save state
  } else {
    if (activeTabId === tabIdToClose) {
      activeTabId = tabs[Math.max(0, tabIndexToClose - 1)].id;
    }
    saveStateToLocalStorage();
    renderAll();
  }
};

const updateTabTitle = (tabId, newTitle) => {
  const tabIndex = tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;
  tabs[tabIndex].title = newTitle.trim() || generateDefaultTabTitle(tabs, tabId);
  saveStateToLocalStorage();
  renderAll(); 
};

const handleClearMemo = () => {
  if (activeTabId === null) return;
  const tabIndex = tabs.findIndex(t => t.id === activeTabId);
  if (tabIndex === -1) return;

  tabs[tabIndex].memoText = '';
  tabs[tabIndex].extractedData = { numbers: [], sum: 0 };
  
  saveStateToLocalStorage();
  renderAll(); 
};

const handleDownloadMemo = () => {
  const currentTab = tabs.find(tab => tab.id === activeTabId);
  if (!currentTab || !currentTab.memoText.trim()) return;

  const { title, memoText, extractedData, createdAt } = currentTab;
  const { numbers, sum } = extractedData;

  let fileContent = `${title}\n`;
  fileContent += `${new Date(createdAt).toLocaleString()}\n\n`;
  fileContent += `--------------------\n${memoText}\n\n`;
  fileContent += `--------------------\n検出された数字:\n--------------------\n`;
  if (numbers.length > 0) {
    numbers.forEach(num => { fileContent += `- ${num.toLocaleString()}\n`; });
  } else {
    fileContent += "なし\n";
  }
  fileContent += `\n--------------------\n合計:\n--------------------\n${sum.toLocaleString()}\n`;

  const sanitizedTitle = sanitizeFilename(title);
  const filename = `${sanitizedTitle}.txt`;
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleThemeChange = (event) => {
  currentThemeId = event.target.value;
  applyThemeToDocument(currentThemeId);
  saveStateToLocalStorage(); 
};

// --- Initialization ---
const initApp = () => {
  console.log("initApp started");
  // Assign DOM elements
  themeSelect = document.getElementById('theme-select');
  appDescription = document.getElementById('app-description');
  tabsListContainer = document.getElementById('tabs-list');
  mainContentArea = document.getElementById('main-content-area');

  console.log("Essential DOM elements found:", { 
    themeSelect: !!themeSelect, 
    appDescription: !!appDescription, 
    tabsListContainer: !!tabsListContainer, 
    mainContentArea: !!mainContentArea 
  });

  if (!themeSelect || !appDescription || !tabsListContainer || !mainContentArea) {
    console.error("Essential DOM elements not found. Aborting initialization.");
    const body = document.querySelector('body');
    if (body) {
        let errorMsg = '<div style="position: fixed; top: 0; left: 0; width: 100%; padding: 20px; background-color: red; color: white; text-align: center; font-family: sans-serif; z-index: 9999;">';
        errorMsg += 'アプリケーションの初期化に失敗しました。ページに必要なHTML要素が見つかりません。HTMLファイルが正しいか確認してください。<br/>不足している要素: ';
        if (!themeSelect) errorMsg += 'theme-select, ';
        if (!appDescription) errorMsg += 'app-description, ';
        if (!tabsListContainer) errorMsg += 'tabs-list, ';
        if (!mainContentArea) errorMsg += 'main-content-area, ';
        errorMsg = errorMsg.slice(0, -2); // Remove last comma and space
        errorMsg += '</div>';
        body.innerHTML = errorMsg + body.innerHTML; // Prepend error message
    }
    return; // Stop further execution
  }

  loadStateFromLocalStorage(); 
  
  if (tabs.length === 0) { // If still no tabs after loading (e.g. fresh start or corrupted storage)
    console.log("No tabs after loadState, ensuring at least one tab exists.");
    addNewTab(true); // isInitial true, so it won't call renderAll/save by itself
  }
  if (!activeTabId && tabs.length > 0) { // Ensure an active tab is set if tabs exist
      activeTabId = tabs[0].id;
      console.log("Active tab ID was not set, defaulting to first tab:", activeTabId);
  }
  
  applyThemeToDocument(currentThemeId); 
  renderThemeSelector(); 
  renderAll(); // This will render everything based on the loaded/initialized state

  themeSelect.addEventListener('change', handleThemeChange);
  console.log("initApp completed successfully.");
};

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOMContentLoaded event fired, calling initApp()");
  initApp();
});

window.addEventListener('storage', (event) => {
    if (event.key === LOCAL_STORAGE_KEY_TABS || event.key === LOCAL_STORAGE_KEY_THEME) {
        console.log('Storage changed in another tab. Reloading state.');
        loadStateFromLocalStorage();
        if (tabs.length === 0) { // Ensure there's a tab if storage clears to empty
            addNewTab(true);
        }
        if (!activeTabId && tabs.length > 0) { // Ensure active tab is set
            activeTabId = tabs[0].id;
        }
        renderAll();
    }
});
