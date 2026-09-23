/* ==========================================================================
   Various functions that we want to use within the template
   ========================================================================== */

/*jslint es6 */
'use strict';

// Constants for CDNs
const PLOTLY_URL = "https://cdn.jsdelivr.net/npm/plotly.js@3.6.0/dist/plotly.min.js";
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

// Detect OS/browser preference
const browserPref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Determine the computed theme, which can be "dark" or "light".
function determineComputedTheme() {
  // Determine the expected state of the theme toggle, which can be "dark", "light", or default "system"
  let themeSetting = localStorage.getItem("theme");
  themeSetting = (themeSetting != "dark" && themeSetting != "light" && themeSetting != "system") ? "system" : themeSetting;

  // Return the setting if set, or use the browser preference
  if (themeSetting != "system") {
    return themeSetting;
  }
  return browserPref ? "dark" : "light";
}

// Set the theme on page load or when explicitly called. Without an argument the
// theme is the stored preference or, failing that, the OS/browser preference.
function setTheme(theme) {
  const use_theme = theme || determineComputedTheme();

  if (use_theme === "dark") {
    $("html").attr("data-theme", "dark");
    $("#theme-icon").removeClass("fa-sun").addClass("fa-moon");
  } else if (use_theme === "light") {
    $("html").removeAttr("data-theme");
    $("#theme-icon").removeClass("fa-moon").addClass("fa-sun");
  }
}

// Toggle the theme manually
function toggleTheme() {
  const current_theme = $("html").attr("data-theme");
  const new_theme = current_theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", new_theme);
  setTheme(new_theme);
  redrawPlotly();
}

// Defer the loading of Mermaid to only if there is a field on the page to be rendered
let mermaidElements = document.querySelectorAll("pre>code.language-mermaid");
if (mermaidElements.length > 0) {
  document.addEventListener("readystatechange", function() {
    // Append the Mermaid module to the DOM
    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.textContent = `
      import mermaid from '${MERMAID_URL}';
      mermaid.initialize({startOnLoad:true, theme:'default'});
      await mermaid.run({querySelector:'code.language-mermaid'});
    `;
    document.body.appendChild(moduleScript);
  });
}

/* ==========================================================================
   Plotly integration script so that Markdown codeblocks will be rendered
   ========================================================================== */

// Read the Plotly data from the code block, hide it, and render the chart as new node. This allows for the
// JSON data to be retrieve when the theme is switched. The listener should only be added if the data is
// actually present on the page.
//
// NOTE that plotlyDarkLayout and plotlyLightLayout will be exposed in the minimized file
let plotlyElements = document.querySelectorAll("pre>code.language-plotly");
if (plotlyElements.length > 0) {
  document.addEventListener("readystatechange", function() {
    // Return if not ready
    if (document.readyState !== "complete") {
      return;
    }

    // Prepare to load Plotly from the CDN
    const script = document.createElement('script');
    script.src = PLOTLY_URL;
    script.async = true;

    // Once loaded, update the page elements to work with it
    script.onload = function() {
      plotlyElements.forEach(function(elem) {
        // Parse the Plotly JSON data and hide it
        let jsonData = JSON.parse(elem.textContent);
        elem.parentElement.classList.add("hidden");

        // Add the Plotly node
        let chartElement = document.createElement("div");
        elem.parentElement.after(chartElement);

        // Set the theme for the plot and render it
        const theme = (determineComputedTheme() === "dark") ? plotlyDarkLayout : plotlyLightLayout;
        if (jsonData.layout) {
          jsonData.layout.template = (jsonData.layout.template) ? { ...theme, ...jsonData.layout.template } : theme;
        } else {
          jsonData.layout = { template: theme };
        }
        Plotly.react(chartElement, jsonData.data, jsonData.layout);
      });
    }

    // Add the script to the document
    document.head.appendChild(script);
  });
}

function redrawPlotly() {
  plotlyElements.forEach(function(elem) {
    // Parse the Plotly JSON data
    let jsonData = JSON.parse(elem.textContent);

    // Get the Plotly node
    let chartElement = $(elem).parent().next().get(0);

    // Set the theme for the plot and render it
    const theme = (determineComputedTheme() === "dark") ? plotlyDarkLayout : plotlyLightLayout;
    if (jsonData.layout) {
      jsonData.layout.template = (jsonData.layout.template) ? { ...theme, ...jsonData.layout.template } : theme;
    } else {
      jsonData.layout = { template: theme };
    }
    Plotly.react(chartElement, jsonData.data, jsonData.layout);
  });
}

/* ==========================================================================
   Actions that should occur when the page has been fully loaded
   ========================================================================== */

$(document).ready(function () {
  // SCSS SETTINGS - These should be the same as the settings in the relevant files
  const scssLarge = 925;          // pixels, from /_sass/_themes.scss
  const scssMastheadHeight = 70;  // pixels, from the current theme (e.g., /_sass/theme/_default.scss)

  // If the user hasn't chosen a theme, follow the OS preference
  setTheme();

  // Add a copy action to article code blocks while preserving their line breaks.
  document.querySelectorAll('.page--post div.highlighter-rouge, .page--post figure.highlight').forEach(function (block) {
    const code = block.querySelector('pre > code');
    if (!code || code.classList.contains('language-mermaid') || code.classList.contains('language-plotly')) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-button';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');
    block.appendChild(button);

    let resetTimer;
    button.addEventListener('click', async function () {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code.textContent);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = code.textContent;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          const copied = document.execCommand('copy');
          textarea.remove();
          if (!copied) throw new Error('Clipboard copy failed');
        }

        button.textContent = '已复制';
        button.setAttribute('aria-label', '代码已复制');
      } catch (error) {
        button.textContent = '复制失败';
        button.setAttribute('aria-label', '复制失败');
      }

      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        button.textContent = '复制';
        button.setAttribute('aria-label', '复制代码');
      }, 2000);
    });
  });

  // Build the optional table of contents from the rendered article headings.
  document.querySelectorAll('.toc__menu').forEach(function (toc) {
    const article = document.querySelector('.page__content');
    if (!article) {
      return;
    }

    const headings = Array.from(article.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
    const stack = [{ level: 0, list: toc }];

    headings.forEach(function (heading, index) {
      const level = Number(heading.tagName.substring(1));
      while (stack.length > 1 && level <= stack[stack.length - 1].level) {
        stack.pop();
      }

      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent;
      item.appendChild(link);
      stack[stack.length - 1].list.appendChild(item);

      const nextHeading = headings[index + 1];
      if (nextHeading && Number(nextHeading.tagName.substring(1)) > level) {
        const nestedList = document.createElement('ul');
        nestedList.className = 'toc__menu';
        item.appendChild(nestedList);
        stack.push({ level: level, list: nestedList });
      }
    });

    if (!headings.length) {
      toc.closest('.sidebar__right').hidden = true;
    }
  });

  // Give wide article tables their own horizontal scroll area.
  document.querySelectorAll('.page__content table').forEach(function (table) {
    if (table.parentElement.classList.contains('table-scroll')) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener("change", (e) => {
          if (!localStorage.getItem("theme")) {
            setTheme(e.matches ? "dark" : "light");
          }
        });

  // Enable the theme toggle
  $('#theme-toggle').on('click', toggleTheme);

  // Follow menu drop down
  $(".author__urls-wrapper button").on("click", function () {
    $(".author__urls").fadeToggle("fast", function () { });
    $(".author__urls-wrapper button").toggleClass("open");
  });

  // Restore the follow menu if toggled on a window resize
  jQuery(window).on('resize', function () {
    if ($('.author__urls.social-icons').css('display') == 'none' && $(window).width() >= scssLarge) {
      $(".author__urls").css('display', 'block')
    }
  });

});
