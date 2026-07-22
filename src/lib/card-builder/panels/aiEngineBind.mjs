/**
 * AI 引擎：Bind（拆自 aiEngine）
 */

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachAiEngineBind(ctx, s, panel) {
  panel.bind = function() {
      s.refreshWorldviewSummary();
      s.syncContinueEnrichBtn();
      window.__refreshAiEngineWorldviewSummary__ = s.refreshWorldviewSummary;
      window.__syncAiContinueEnrichBtn__ = s.syncContinueEnrichBtn;
      window.addEventListener('worldview-presets-changed', function() {
        s.refreshWorldviewSummary();
      });
      window.addEventListener('nsfw-config-changed', function() {
        s.refreshWorldviewSummary();
      });

      var presetInput = ctx.$('presetInput');
      if (presetInput) {
        presetInput.addEventListener('change', function(e) {
          var file = e.target.files[0]; if (!file) return;
          var reader = new FileReader();
          reader.onload = function(ev) {
            try {
              var data = JSON.parse(ev.target.result);
              s.parsedPresetList = [];
              if (data.prompts) {
                var ao = (data.prompt_order && data.prompt_order.length > 0)
                  ? data.prompt_order[data.prompt_order.length - 1].order : [];
                var ei = ao.filter(function(i) { return i.enabled; }).map(function(i) { return i.identifier; });
                data.prompts.forEach(function(p) {
                  if (p.content && !p.marker) {
                    s.parsedPresetList.push({
                      id:                 p.identifier,
                      name:               p.name || '规则',
                      content:            p.content,
                      role:               p.role || 'system',
                      injection_position: p.injection_position || 0,
                      injection_depth:    p.injection_depth || 4,
                      enabled:            ao.length > 0 ? ei.indexOf(p.identifier) >= 0 : true,
                    });
                  }
                });
              }
              ctx.panels.aiEngine.renderPresetList();
              s.persistAiConfig();
            } catch (err) {
              var presetStatus = ctx.$('presetStatus');
              if (presetStatus) {
                presetStatus.innerHTML = '\u274c 解析失败: ' + err.message;
                presetStatus.style.color = '#ef4444';
              }
              var presetListContainer = ctx.$('presetListContainer');
              if (presetListContainer) presetListContainer.style.display = 'none';
            }
          };
          reader.readAsText(file);
        });
      }

      var btnFetchModels = ctx.$('btnFetchModels');
      if (btnFetchModels) {
        btnFetchModels.addEventListener('click', function() {
          ctx.panels.aiEngine.fetchModels();
        });
      }

      var btnAiGenerate = ctx.$('btnAiGenerate');
      if (btnAiGenerate) {
        btnAiGenerate.addEventListener('click', function() {
          ctx.panels.aiEngine.runFullGeneration();
        });
      }

      var btnAiContinueEnrich = ctx.$('btnAiContinueEnrich');
      if (btnAiContinueEnrich) {
        btnAiContinueEnrich.addEventListener('click', function() {
          ctx.panels.aiEngine.continueEnrichFromOutline();
        });
      }

      var genModeEl = ctx.$('aiEngineGenMode');
      if (genModeEl) {
        genModeEl.addEventListener('change', function() {
          s.syncEngineModeUi();
          s.persistAiConfig();
        });
      }
      var pauseEl = ctx.$('aiEnginePauseAfterOutline');
      if (pauseEl) {
        pauseEl.addEventListener('change', function() {
          s.persistAiConfig();
        });
      }
      var skCountEl = ctx.$('wbSkeletonCount');
      if (skCountEl) {
        skCountEl.addEventListener('change', function() { s.persistAiConfig(); });
        skCountEl.addEventListener('input', function() { s.persistAiConfig(); });
      }
      document.querySelectorAll('.wb-count-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          // AIPanel 已改 value；下一帧持久化
          setTimeout(function() { s.persistAiConfig(); }, 0);
        });
      });

      s.syncEngineModeUi();

      // 单条世界书按钮由 worldbook.bind 独占（避免双绑定）

      var btnAiGenCharTags = ctx.$('btnAiGenCharTags');
      if (btnAiGenCharTags) {
        btnAiGenCharTags.addEventListener('click', function() {
          ctx.panels.aiEngine.runCharTagsGen();
        });
      }
  };
}
