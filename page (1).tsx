:root {
  color-scheme: light;
  --bg: #f3f6f4;
  --card: #ffffff;
  --text: #17221e;
  --muted: #64716c;
  --border: #dbe4df;
  --accent: #166348;
  --accent-dark: #0d4431;
}
* { box-sizing: border-box; }
html { min-height: 100%; }
body { margin: 0; min-height: 100vh; font-family: Arial, Helvetica, sans-serif; background: var(--bg); color: var(--text); }
a { color: inherit; text-decoration: none; }
header { background: var(--accent-dark); color: white; padding: 17px 0; }
.header-inner { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.brand { font-weight: 800; letter-spacing: -.02em; }
nav { display: flex; gap: 20px; font-size: .95rem; }
.wrap { width: min(1080px, calc(100% - 32px)); margin: 0 auto; }
main { padding: 34px 0 64px; min-height: calc(100vh - 137px); }
.hero { padding: 34px; background: linear-gradient(135deg, #164b39, #23815f); color: white; border-radius: 20px; margin-bottom: 22px; }
.hero h1 { font-size: clamp(2rem, 5vw, 3.3rem); margin: 4px 0 10px; letter-spacing: -.04em; }
.hero p { max-width: 650px; line-height: 1.6; margin-bottom: 0; }
.eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; font-weight: 800; opacity: .8; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 15px; padding: 22px; box-shadow: 0 5px 20px rgba(15, 40, 30, .05); overflow-x: auto; }
.card h2 { margin-top: 0; }
.muted { color: var(--muted); line-height: 1.55; }
.status { font-weight: 700; display: flex; align-items: center; gap: 9px; }
.status span { width: 10px; height: 10px; border-radius: 50%; background: #2a9b68; box-shadow: 0 0 0 4px #dff3e9; }
table { width: 100%; border-collapse: collapse; background: white; }
th, td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
th { background: #eaf1ed; }
input, button, select { font: inherit; padding: 12px; border-radius: 9px; border: 1px solid #b9c8c0; }
input:focus { outline: 3px solid #d8eee4; border-color: var(--accent); }
button { background: var(--accent); color: white; border: 0; cursor: pointer; font-weight: 800; }
button:hover { background: var(--accent-dark); }
form { display: grid; gap: 12px; }
label { font-weight: 700; }
footer { border-top: 1px solid var(--border); color: var(--muted); padding: 20px 0; font-size: .9rem; }
@media (max-width: 600px) { .header-inner { align-items: flex-start; flex-direction: column; } .hero { padding: 25px; } }
.compact-hero { padding-block: 25px; }
.hero-row { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.hero-row h1 { font-size: clamp(1.8rem, 4vw, 2.7rem); }
.hero-row form { display: block; }
button.secondary { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.35); white-space: nowrap; }
button.secondary:hover { background: rgba(255,255,255,.25); }
.narrow-card { max-width: 520px; margin-inline: auto; }
.section-gap { margin-top: 16px; }
.alert { border-radius: 10px; padding: 13px 15px; font-weight: 700; margin: 0 0 16px; }
.alert.success { background: #dff3e9; color: #14583f; border: 1px solid #a9d8c2; }
.alert.error { background: #fee8e7; color: #8b2722; border: 1px solid #efb8b4; overflow-wrap: anywhere; }
.badge { display: inline-block; background: #eaf1ed; border-radius: 999px; padding: 5px 9px; font-size: .83rem; font-weight: 700; }
.text-link { color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 600px) { .hero-row { align-items: flex-start; flex-direction: column; } }
.cup-section { margin-top: 28px; }
.section-heading { display: flex; justify-content: space-between; align-items: end; margin: 0 2px 12px; }
.section-heading h2 { margin: 2px 0 0; font-size: 1.7rem; }
.eyebrow.dark { color: var(--accent); opacity: 1; margin: 0; }
.standings-card { margin-bottom: 16px; }
.standings-card h3 { margin-top: 0; font-size: 1.25rem; }
details summary { cursor: pointer; color: var(--accent-dark); font-weight: 800; }
.result-detail { margin-top: 10px; min-width: 530px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: #f8faf9; }
.result-detail table { font-size: .88rem; }
.result-detail th, .result-detail td { padding: 8px; }
tr.dropped td { color: var(--muted); text-decoration: line-through; background: #f5f6f5; }
.table-note { margin: 14px 0 0; color: var(--muted); font-size: .9rem; }
.success-badge { background: #dff3e9; color: #14583f; }
.small-button { padding: 8px 11px; font-size: .85rem; white-space: nowrap; }
td form { display: inline; }
.action-stack { display: grid; gap: .45rem; min-width: 150px; }
.error-text { color: #9b1c1c; max-width: 280px; overflow-wrap: anywhere; }
button:disabled { opacity: .45; cursor: not-allowed; }

.import-list { display: grid; gap: 12px; margin-top: 16px; }
.import-card { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: #f8faf9; }
.import-meta { margin: 5px 0 9px; font-size: .92rem; }
.import-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.import-actions form { display: block; }
.source-button { display: inline-block; padding: 12px; border: 1px solid #b9c8c0; border-radius: 9px; color: var(--accent-dark); background: white; font-weight: 800; white-space: nowrap; }
@media (max-width: 700px) {
  .import-card { align-items: stretch; flex-direction: column; }
  .import-actions { display: grid; grid-template-columns: 1fr; }
  .import-actions button, .source-button { width: 100%; text-align: center; }
}
