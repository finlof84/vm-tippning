import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const GROUPS = {
  A: ["USA", "Mexiko", "Kanada", "Panama"],
  B: ["Spanien", "Uruguay", "Egypten", "Botswana"],
  C: ["Argentina", "Chile", "Peru", "Albanien"],
  D: ["Frankrike", "Belgien", "Senegal", "Elfenbenskusten"],
  E: ["Brasilien", "Colombia", "Ecuador", "Kamerun"],
  F: ["England", "Portugal", "Tunisien", "Irak"],
  G: ["Tyskland", "Nederlaenderna", "Sydkorea", "Saudiarabien"],
  H: ["Japan", "Australien", "Marocko", "Algeriet"],
  I: ["Italien", "Kroatien", "Paraguay", "Honduras"],
  J: ["Serbien", "Ungern", "Ghana", "Kongo"],
  K: ["Iran", "Uzbekistan", "Tanzania", "Nya Zeeland"],
  L: ["Turkiet", "Ukraina", "Rumanien", "Zambia"],
};

const TEAM_DISPLAY = { "Nederlaenderna": "Nederlanderna", "Rumanien": "Rumanien" };
function dn(team) { return TEAM_DISPLAY[team] || team; }

const CC = {
  "USA":"US","Mexiko":"MX","Kanada":"CA","Panama":"PA",
  "Spanien":"ES","Uruguay":"UY","Egypten":"EG","Botswana":"BW",
  "Argentina":"AR","Chile":"CL","Peru":"PE","Albanien":"AL",
  "Frankrike":"FR","Belgien":"BE","Senegal":"SN","Elfenbenskusten":"CI",
  "Brasilien":"BR","Colombia":"CO","Ecuador":"EC","Kamerun":"CM",
  "England":"EN","Portugal":"PT","Tunisien":"TN","Irak":"IQ",
  "Tyskland":"DE","Nederlaenderna":"NL","Sydkorea":"KR","Saudiarabien":"SA",
  "Japan":"JP","Australien":"AU","Marocko":"MA","Algeriet":"DZ",
  "Italien":"IT","Kroatien":"HR","Paraguay":"PY","Honduras":"HN",
  "Serbien":"RS","Ungern":"HU","Ghana":"GH","Kongo":"CD",
  "Iran":"IR","Uzbekistan":"UZ","Tanzania":"TZ","Nya Zeeland":"NZ",
  "Turkiet":"TR","Ukraina":"UA","Rumanien":"RO","Zambia":"ZM",
};
function gc(team) { return CC[team] || "??"; }

const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([group, teams]) => {
  const ms = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      ms.push({ id: group+i+j, group, home: teams[i], away: teams[j], phase: "Grupp" });
  return ms;
});

// Sextondelsfinal (Round of 32): 16 matcher
// 12 fasta matchningar (etta vs tvaa) + 4 matcher for treorna (admin fyller i lag)
// Fasta matchningar enligt FIFA VM 2026 schema:
const R32_FIXED = [
  {id:"R32_1",  phase:"Sextondelsfinal", homeKey:"A0", awayKey:"B1"},
  {id:"R32_2",  phase:"Sextondelsfinal", homeKey:"B0", awayKey:"A1"},
  {id:"R32_3",  phase:"Sextondelsfinal", homeKey:"C0", awayKey:"D1"},
  {id:"R32_4",  phase:"Sextondelsfinal", homeKey:"D0", awayKey:"C1"},
  {id:"R32_5",  phase:"Sextondelsfinal", homeKey:"E0", awayKey:"F1"},
  {id:"R32_6",  phase:"Sextondelsfinal", homeKey:"F0", awayKey:"E1"},
  {id:"R32_7",  phase:"Sextondelsfinal", homeKey:"G0", awayKey:"H1"},
  {id:"R32_8",  phase:"Sextondelsfinal", homeKey:"H0", awayKey:"G1"},
  {id:"R32_9",  phase:"Sextondelsfinal", homeKey:"I0", awayKey:"J1"},
  {id:"R32_10", phase:"Sextondelsfinal", homeKey:"J0", awayKey:"I1"},
  {id:"R32_11", phase:"Sextondelsfinal", homeKey:"K0", awayKey:"L1"},
  {id:"R32_12", phase:"Sextondelsfinal", homeKey:"L0", awayKey:"K1"},
];
// 4 matcher for de 8 basta treorna - lag fylls i av admin efter gruppspelet
const R32_THIRDS = [
  {id:"R32_13", phase:"Sextondelsfinal", homeKey:"THIRD_A", awayKey:"THIRD_B"},
  {id:"R32_14", phase:"Sextondelsfinal", homeKey:"THIRD_C", awayKey:"THIRD_D"},
  {id:"R32_15", phase:"Sextondelsfinal", homeKey:"THIRD_E", awayKey:"THIRD_F"},
  {id:"R32_16", phase:"Sextondelsfinal", homeKey:"THIRD_G", awayKey:"THIRD_H"},
];
const R32 = [...R32_FIXED, ...R32_THIRDS];

// Attondelsfinaler (Round of 16): 8 matcher - vinnare av R32
const R16 = [
  {id:"R16_1", phase:"Attondelsfinaler", homeKey:"R32_1",  awayKey:"R32_2"},
  {id:"R16_2", phase:"Attondelsfinaler", homeKey:"R32_3",  awayKey:"R32_4"},
  {id:"R16_3", phase:"Attondelsfinaler", homeKey:"R32_5",  awayKey:"R32_6"},
  {id:"R16_4", phase:"Attondelsfinaler", homeKey:"R32_7",  awayKey:"R32_8"},
  {id:"R16_5", phase:"Attondelsfinaler", homeKey:"R32_9",  awayKey:"R32_10"},
  {id:"R16_6", phase:"Attondelsfinaler", homeKey:"R32_11", awayKey:"R32_12"},
  {id:"R16_7", phase:"Attondelsfinaler", homeKey:"R32_13", awayKey:"R32_14"},
  {id:"R16_8", phase:"Attondelsfinaler", homeKey:"R32_15", awayKey:"R32_16"},
];

const QF = [
  {id:"QF_1", phase:"Kvartsfinal", homeKey:"R16_1", awayKey:"R16_2"},
  {id:"QF_2", phase:"Kvartsfinal", homeKey:"R16_3", awayKey:"R16_4"},
  {id:"QF_3", phase:"Kvartsfinal", homeKey:"R16_5", awayKey:"R16_6"},
  {id:"QF_4", phase:"Kvartsfinal", homeKey:"R16_7", awayKey:"R16_8"},
];

const SF = [
  {id:"SF_1", phase:"Semifinal", homeKey:"QF_1", awayKey:"QF_2"},
  {id:"SF_2", phase:"Semifinal", homeKey:"QF_3", awayKey:"QF_4"},
];

const LATE = [
  {id:"BRONS", phase:"Bronsmatch", homeKey:"SF_1L", awayKey:"SF_2L"},
  {id:"FINAL", phase:"Final",      homeKey:"SF_1",  awayKey:"SF_2"},
];

const KNOCKOUT_ALL = [...R32, ...R16, ...QF, ...SF, ...LATE];
const PHASES = ["Grupp","Sextondelsfinal","Attondelsfinaler","Kvartsfinal","Semifinal","Bronsmatch","Final"];

function calcGroupStandings(group, results) {
  const teams = GROUPS[group];
  const s = {};
  teams.forEach(t => { s[t] = {pts:0,gf:0,ga:0,gd:0,pl:0}; });
  GROUP_MATCHES.filter(m => m.group === group).forEach(m => {
    const r = results[m.id];
    if (!r || r.home === "" || r.away === "") return;
    const gh = parseInt(r.home), ga = parseInt(r.away);
    if (isNaN(gh)||isNaN(ga)) return;
    s[m.home].pl++; s[m.away].pl++;
    s[m.home].gf+=gh; s[m.home].ga+=ga; s[m.home].gd+=gh-ga;
    s[m.away].gf+=ga; s[m.away].ga+=gh; s[m.away].gd+=ga-gh;
    if (gh>ga)      { s[m.home].pts+=3; }
    else if (gh<ga) { s[m.away].pts+=3; }
    else            { s[m.home].pts+=1; s[m.away].pts+=1; }
  });
  return teams.map(t=>({team:t,...s[t]}))
    .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));
}

function getBestThirds(results) {
  return Object.keys(GROUPS)
    .map(g => { const st = calcGroupStandings(g,results); return st[2]?{...st[2],group:g}:null; })
    .filter(Boolean)
    .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team))
    .slice(0,8);
}

function resolveGroupPlacements(results) {
  const p = {};
  Object.keys(GROUPS).forEach(g => {
    const st = calcGroupStandings(g, results);
    p[g+"0"] = st[0]?.team || null;
    p[g+"1"] = st[1]?.team || null;
  });
  const thirds = getBestThirds(results);
  thirds.forEach((t,i) => { p["THIRD_"+String.fromCharCode(65+i)] = t?.team||null; });
  return p;
}

// thirdOverrides: admin kan manuellt saga vilket lag som ar THIRD_A..H
// om FIFA:s schema ger en annan matchning an automatisk ranking
function resolveKOTeams(matchId, placements, results, thirdOverrides) {
  const all = KNOCKOUT_ALL;
  const match = all.find(m => m.id === matchId);
  if (!match) return {home:null,away:null};

  function teamFromKey(key) {
    if (/^[A-L][01]$/.test(key)) return placements[key]||null;
    if (/^THIRD_[A-H]$/.test(key)) return (thirdOverrides&&thirdOverrides[key])||placements[key]||null;
    if (key.endsWith("L")) return loser(key.slice(0,-1));
    return winner(key);
  }
  function winner(id) {
    const r = results[id];
    if (!r||r.home===""||r.away==="") return null;
    const gh=parseInt(r.home), ga=parseInt(r.away);
    if (isNaN(gh)||isNaN(ga)) return null;
    const {home:ht,away:at} = resolveKOTeams(id, placements, results, thirdOverrides);
    if (gh>ga) return ht; if (ga>gh) return at; return null;
  }
  function loser(id) {
    const r = results[id];
    if (!r||r.home===""||r.away==="") return null;
    const gh=parseInt(r.home), ga=parseInt(r.away);
    if (isNaN(gh)||isNaN(ga)) return null;
    const {home:ht,away:at} = resolveKOTeams(id, placements, results, thirdOverrides);
    if (gh>ga) return at; if (ga>gh) return ht; return null;
  }
  return {home: teamFromKey(match.homeKey), away: teamFromKey(match.awayKey)};
}

function labelFromKey(key) {
  if (/^[A-L]0$/.test(key)) return "Etta grupp "+key[0];
  if (/^[A-L]1$/.test(key)) return "Tvaa grupp "+key[0];
  if (/^THIRD_[A-H]$/.test(key)) return "Trea #"+(key.charCodeAt(6)-64);
  if (key.endsWith("L")) return "Forlorare "+key.slice(0,-1);
  return "Vinnare "+key;
}

function calcPoints(tip, result) {
  if (!tip||!result) return 0;
  const th=parseInt(tip.home), ta=parseInt(tip.away);
  const rh=parseInt(result.home), ra=parseInt(result.away);
  if (isNaN(th)||isNaN(ta)||isNaN(rh)||isNaN(ra)) return 0;
  if (th===rh&&ta===ra) return 3;
  if (Math.sign(th-ta)===Math.sign(rh-ra)) return 1;
  return 0;
}
function calcTotal(tips, results) {
  return [...GROUP_MATCHES,...KNOCKOUT_ALL].reduce((s,m)=>s+calcPoints(tips[m.id],results[m.id]),0);
}

const ADMIN_CODE = "vm2026admin";
async function fbSet(id, data) {
  await setDoc(doc(db,"vm2026",id), data, {merge:true});
}

// =============================================================================
export default function App() {
  const [view,         setView]         = useState("start");
  const [participants, setParticipants] = useState({});
  const [results,      setResults]      = useState({});
  const [deadlines,    setDeadlines]    = useState({});
  const [thirdOverrides, setThirdOverrides] = useState({});
  const [currentUser,  setCurrentUser]  = useState(null);
  const [nameInput,    setNameInput]    = useState("");
  const [tipPhase,     setTipPhase]     = useState("Grupp");
  const [tipGroup,     setTipGroup]     = useState("A");
  const [adminCode,    setAdminCode]    = useState("");
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [saveStatus,   setSaveStatus]   = useState("");
  const [loading,      setLoading]      = useState(true);
  const [adminTab,     setAdminTab]     = useState("results");
  const [dlInput,      setDlInput]      = useState({});
  const [now,          setNow]          = useState(Date.now());

  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return ()=>clearInterval(t); },[]);

  useEffect(()=>{
    const unsubs = [
      onSnapshot(doc(db,"vm2026","participants"), s=>{if(s.exists())setParticipants(s.data());setLoading(false);},()=>setLoading(false)),
      onSnapshot(doc(db,"vm2026","results"),      s=>{if(s.exists())setResults(s.data());}),
      onSnapshot(doc(db,"vm2026","deadlines"),    s=>{if(s.exists())setDeadlines(s.data());}),
      onSnapshot(doc(db,"vm2026","thirdOverrides"),s=>{if(s.exists())setThirdOverrides(s.data());}),
    ];
    return ()=>unsubs.forEach(u=>u());
  },[]);

  const placements = resolveGroupPlacements(results);
  function getTeams(mid) { return resolveKOTeams(mid, placements, results, thirdOverrides); }
  function getDisplay(m) {
    if (m.phase==="Grupp") return {home:dn(m.home), away:dn(m.away)};
    const {home,away} = getTeams(m.id);
    return {home:home?dn(home):labelFromKey(m.homeKey), away:away?dn(away):labelFromKey(m.awayKey)};
  }
  function isLocked(mid) { const dl=deadlines[mid]; return dl&&now>=new Date(dl).getTime(); }
  function fmtDl(mid) {
    const dl=deadlines[mid]; if(!dl) return null;
    return new Date(dl).toLocaleString("sv-SE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  async function handleJoin() {
    const name=nameInput.trim(); if(!name) return;
    const upd={...participants}; if(!upd[name]) upd[name]={};
    await fbSet("participants",upd); setCurrentUser(name); setView("tips"); setNameInput("");
  }
  async function handleTip(mid, side, val) {
    if(isLocked(mid)) return;
    await fbSet("participants",{...participants,[currentUser]:{...(participants[currentUser]||{}),[mid]:{...(participants[currentUser]?.[mid]||{}),[side]:val}}});
  }
  async function handleSave() {
    setSaveStatus("Sparar..."); await fbSet("participants",participants);
    setSaveStatus("Sparat!"); setTimeout(()=>setSaveStatus(""),2500);
  }
  function handleAdminLogin() {
    if(adminCode===ADMIN_CODE){setIsAdmin(true);setView("admin");}
    else alert("Fel losenord");
  }
  async function handleResult(mid, side, val) {
    await fbSet("results",{...results,[mid]:{...(results[mid]||{}),[side]:val}});
  }
  async function setDeadline(mid, iso) { await fbSet("deadlines",{...deadlines,[mid]:iso}); }
  async function rmDeadline(mid) {
    const upd={...deadlines}; delete upd[mid];
    await setDoc(doc(db,"vm2026","deadlines"),upd);
  }
  async function bulkDeadline(group, iso) {
    if(!iso) return;
    const upd={...deadlines};
    GROUP_MATCHES.filter(m=>m.group===group).forEach(m=>{upd[m.id]=iso;});
    await fbSet("deadlines",upd);
  }
  async function handleThirdOverride(key, team) {
    const upd={...thirdOverrides,[key]:team};
    await fbSet("thirdOverrides",upd);
  }

  const leaderboard = Object.entries(participants)
    .map(([name,tips])=>({name,points:calcTotal(tips,results),
      tipped:[...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m=>{const t=tips[m.id];return t&&t.home!=""&&t.away!="";}).length}))
    .sort((a,b)=>b.points-a.points);

  const userTips = participants[currentUser]||{};
  const totalMatches = GROUP_MATCHES.length+KNOCKOUT_ALL.length;
  function countTipped() {
    return [...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m=>{const t=userTips[m.id];return t&&t.home!=""&&t.away!="";}).length;
  }

  const filteredMatches = tipPhase==="Grupp"
    ? GROUP_MATCHES.filter(m=>m.group===tipGroup)
    : KNOCKOUT_ALL.filter(m=>m.phase===tipPhase);

  const bestThirds = getBestThirds(results);

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#0a1628",color:"#f5c842",fontFamily:"Georgia,serif",fontSize:20}}>
      Laddar VM-tippning 2026...
    </div>
  );

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@400;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0} body{background:#0a1628}
    .pf{font-family:'Playfair Display',Georgia,serif}
    .ss{font-family:'Source Sans 3',Arial,sans-serif}
    input[type=number],input[type=text],input[type=password],input[type=datetime-local]{
      background:rgba(255,255,255,0.07);border:1px solid rgba(255,200,80,0.25);border-radius:6px;
      color:#f0e6d3;padding:8px 12px;font-size:15px;outline:none;font-family:'Source Sans 3',sans-serif;transition:border .2s;}
    input[type=number]{width:56px;text-align:center}
    input[type=datetime-local]{color-scheme:dark;font-size:13px;padding:6px 10px}
    input:focus{border-color:#f5c842} input:disabled{opacity:.4;cursor:not-allowed}
    select{background:rgba(255,255,255,0.07);border:1px solid rgba(255,200,80,0.25);border-radius:6px;
      color:#f0e6d3;padding:6px 10px;font-size:13px;font-family:'Source Sans 3',sans-serif;outline:none;}
    .btn{display:inline-block;background:#f5c842;color:#0a1628;border:none;border-radius:8px;
      padding:10px 22px;font-weight:700;font-size:14px;cursor:pointer;
      font-family:'Source Sans 3',sans-serif;transition:background .15s,transform .1s}
    .btn:hover{background:#ffd96b;transform:translateY(-1px)} .btn:active{transform:scale(.98)}
    .btn-sm{padding:6px 14px;font-size:12px;border-radius:6px}
    .btn-danger{background:#b83232;color:#fff} .btn-danger:hover{background:#d44}
    .tab{background:transparent;border:none;color:#a09070;padding:8px 14px;cursor:pointer;
      font-size:13px;border-bottom:2px solid transparent;transition:all .15s;
      font-family:'Source Sans 3',sans-serif;font-weight:600}
    .tab.active{color:#f5c842;border-bottom-color:#f5c842} .tab:hover:not(.active){color:#d4b870}
    .mc{background:rgba(255,255,255,0.04);border:1px solid rgba(255,200,80,0.1);
      border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:8px}
    .mc.tipped{border-color:rgba(80,200,120,0.3);background:rgba(80,200,120,0.04)}
    .mc.locked-card{border-color:rgba(180,70,70,0.25);background:rgba(140,50,50,0.05)}
    .nav-link{background:none;border:none;color:#a09070;cursor:pointer;font-size:13px;
      font-family:'Source Sans 3',sans-serif;padding:6px 11px;border-radius:6px;font-weight:600;transition:all .15s}
    .nav-link:hover{color:#f5c842;background:rgba(245,200,66,0.06)} .nav-link.active{color:#f5c842}
    .gbtn{background:rgba(255,255,255,0.06);color:#a09070;border:none;border-radius:5px;
      padding:5px 11px;cursor:pointer;font-weight:700;font-size:12px;
      font-family:'Source Sans 3',sans-serif;transition:all .15s}
    .gbtn.active{background:#f5c842;color:#0a1628}
    .scroll-x{overflow-x:auto}
    ::-webkit-scrollbar{height:4px;width:4px} ::-webkit-scrollbar-track{background:#0a1628}
    ::-webkit-scrollbar-thumb{background:#3a3020;border-radius:2px}
    .lock-badge{background:rgba(200,70,70,0.15);color:#e08080;border:1px solid rgba(200,70,70,0.22);
      border-radius:4px;padding:1px 7px;font-size:10px;font-family:'Source Sans 3',sans-serif;white-space:nowrap}
    .open-badge{background:rgba(80,200,120,0.1);color:#4dc87a;border:1px solid rgba(80,200,120,0.2);
      border-radius:4px;padding:1px 7px;font-size:10px;font-family:'Source Sans 3',sans-serif;white-space:nowrap}
    .tn{font-size:13px;font-weight:600;flex:1;font-family:'Source Sans 3',sans-serif;min-width:55px}
    .fc{display:inline-block;background:rgba(255,255,255,0.12);color:#f0e6d3;border-radius:3px;
      font-size:9px;font-weight:700;padding:1px 4px;font-family:'Source Sans 3',sans-serif;
      margin-right:4px;vertical-align:middle}
  `;

  function FC({team}) { return <span className="fc">{gc(team)}</span>; }
  function TL({team,label}) {
    if(!team) return <span style={{color:"#50403a"}}>{label||"--"}</span>;
    return <><FC team={team}/>{dn(team)}</>;
  }

  return(
    <div style={{minHeight:"100vh",background:"#0a1628",fontFamily:"Georgia,serif",color:"#f0e6d3"}}>
      <style>{css}</style>
      <header style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(245,200,66,0.15)",padding:"0 16px"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontSize:22}}>&#9917;</span>
            <span className="pf" style={{fontSize:16,color:"#f5c842",fontWeight:900}}>VM-Tippning 2026</span>
          </div>
          <nav style={{display:"flex",gap:1,flexWrap:"wrap"}}>
            <button className={"nav-link"+(view==="start"?" active":"")} onClick={()=>setView("start")}>Hem</button>
            {currentUser&&<button className={"nav-link"+(view==="tips"?" active":"")} onClick={()=>setView("tips")}>Mina tips</button>}
            <button className={"nav-link"+(view==="leaderboard"?" active":"")} onClick={()=>setView("leaderboard")}>Topplista</button>
            <button className={"nav-link"+(view==="results"?" active":"")} onClick={()=>setView("results")}>Resultat</button>
            <button className={"nav-link"+(view==="bracket"?" active":"")} onClick={()=>setView("bracket")}>Slutspel</button>
            {!isAdmin&&<button className={"nav-link"+(view==="adminlogin"?" active":"")} onClick={()=>setView("adminlogin")}>Admin</button>}
            {isAdmin &&<button className={"nav-link"+(view==="admin"?" active":"")} onClick={()=>setView("admin")}>Admin</button>}
          </nav>
        </div>
      </header>

      <main style={{maxWidth:1000,margin:"0 auto",padding:"28px 16px 80px"}}>

        {/* START */}
        {view==="start"&&(
          <div style={{textAlign:"center",paddingTop:28}}>
            <div style={{fontSize:56,marginBottom:14}}>&#127942;</div>
            <h1 className="pf" style={{fontSize:42,color:"#f5c842",fontWeight:900,lineHeight:1.1,marginBottom:9}}>FIFA VM 2026</h1>
            <p className="ss" style={{fontSize:17,color:"#a09070",marginBottom:5}}>USA &middot; Mexiko &middot; Kanada</p>
            <p className="ss" style={{fontSize:13,color:"#60504a",marginBottom:40}}>11 juni - 19 juli 2026</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:44}}>
              {[
                {label:"104 matcher",sub:"72 grupp + 32 slutspel"},
                {label:Object.keys(participants).length+" deltagare",sub:"registrerade tippare"},
                {label:"3p / 1p / 0p",sub:"ratt / ratt utfall / fel"},
              ].map(c=>(
                <div key={c.label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.12)",borderRadius:12,padding:"16px 24px",minWidth:140}}>
                  <div className="pf" style={{fontSize:16,color:"#f5c842",fontWeight:700,marginBottom:4}}>{c.label}</div>
                  <div className="ss" style={{fontSize:11,color:"#60504a"}}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:14,padding:"26px 22px",maxWidth:400,margin:"0 auto 20px"}}>
              <h2 className="pf" style={{fontSize:19,color:"#f5c842",marginBottom:16,fontWeight:700}}>Ga in och tippa</h2>
              <div style={{display:"flex",gap:8}}>
                <input type="text" placeholder="Ditt namn" value={nameInput}
                  onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleJoin()} style={{flex:1}}/>
                <button className="btn" onClick={handleJoin}>Tippa!</button>
              </div>
              {Object.keys(participants).length>0&&(
                <p className="ss" style={{fontSize:11,color:"#60504a",marginTop:9}}>Befintliga: {Object.keys(participants).join(", ")}</p>
              )}
            </div>
            <div style={{background:"rgba(245,200,66,0.05)",border:"1px solid rgba(245,200,66,0.14)",borderRadius:9,padding:"13px 17px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
              <p className="ss" style={{fontSize:11,color:"#a09070",lineHeight:1.8}}>
                <strong style={{color:"#f5c842"}}>Pongsystem:</strong><br/>
                3 poang - Exakt ratt resultat<br/>
                1 poang - Ratt utfall (vinst/oavgjort/forlust)<br/>
                0 poang - Fel
              </p>
            </div>
          </div>
        )}

        {/* TIPS */}
        {view==="tips"&&currentUser&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <div>
                <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700}}>{currentUser}s tips</h2>
                <p className="ss" style={{fontSize:12,color:"#60504a",marginTop:3}}>{countTipped()} / {totalMatches} matcher tippade</p>
              </div>
              <div style={{display:"flex",gap:9,alignItems:"center"}}>
                {saveStatus&&<span className="ss" style={{fontSize:13,color:"#50c878"}}>{saveStatus}</span>}
                <button className="btn btn-sm" onClick={handleSave}>Spara</button>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:4,height:5,marginBottom:22,overflow:"hidden"}}>
              <div style={{background:"#f5c842",height:"100%",width:(countTipped()/totalMatches*100)+"%",transition:"width .3s",borderRadius:4}}/>
            </div>
            <div className="scroll-x" style={{marginBottom:12}}>
              <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",minWidth:"max-content"}}>
                {PHASES.map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{p}</button>)}
              </div>
            </div>
            {tipPhase==="Grupp"&&(
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
                {Object.keys(GROUPS).map(g=>(
                  <button key={g} className={"gbtn"+(tipGroup===g?" active":"")} onClick={()=>setTipGroup(g)}>Grupp {g}</button>
                ))}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {filteredMatches.map(m=>{
                const tip=userTips[m.id]||{home:"",away:""};
                const tipped=tip.home!=""&&tip.away!="";
                const locked=isLocked(m.id);
                const dl=fmtDl(m.id);
                const hasResult=results[m.id]&&results[m.id].home!=""&&results[m.id].away!="";
                const pts=calcPoints(tip,results[m.id]);
                const disp=getDisplay(m);
                const ht=m.phase==="Grupp"?m.home:getTeams(m.id).home;
                const at=m.phase==="Grupp"?m.away:getTeams(m.id).away;
                return(
                  <div key={m.id} className={"mc"+(locked?" locked-card":tipped?" tipped":"")}>
                    <span className="tn" style={{textAlign:"right"}}><TL team={ht} label={disp.home}/></span>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <input type="number" min="0" max="20" value={tip.home} disabled={locked}
                          onChange={e=>handleTip(m.id,"home",e.target.value)}/>
                        <span className="ss" style={{color:"#504040",fontSize:11}}>-</span>
                        <input type="number" min="0" max="20" value={tip.away} disabled={locked}
                          onChange={e=>handleTip(m.id,"away",e.target.value)}/>
                      </div>
                      {locked&&<span className="lock-badge">Last</span>}
                      {!locked&&dl&&<span className="open-badge">Stanger {dl}</span>}
                    </div>
                    <span className="tn"><TL team={at} label={disp.away}/></span>
                    {hasResult&&<span className="ss" style={{fontSize:12,fontWeight:700,minWidth:26,textAlign:"center",
                      color:pts===3?"#50c878":pts===1?"#f5c842":"#a05050"}}>{pts}p</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TOPPLISTA */}
        {view==="leaderboard"&&(
          <div>
            <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:5}}>Topplista</h2>
            <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:26}}>Uppdateras nar resultat registreras</p>
            {leaderboard.length===0?(
              <p className="ss" style={{color:"#60504a",textAlign:"center",padding:"60px 0"}}>Inga tippare annu!</p>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {leaderboard.map((e,i)=>(
                  <div key={e.name} style={{background:i===0?"rgba(245,200,66,0.08)":"rgba(255,255,255,0.04)",
                    border:"1px solid "+(i===0?"rgba(245,200,66,0.3)":"rgba(255,255,255,0.07)"),
                    borderRadius:11,padding:"13px 20px",display:"flex",alignItems:"center",gap:14}}>
                    <span className="ss" style={{fontSize:i<3?18:13,minWidth:30,textAlign:"center",fontWeight:700,color:"#f5c842"}}>#{i+1}</span>
                    <div style={{flex:1}}>
                      <div className="pf" style={{fontSize:16,fontWeight:700,color:i===0?"#f5c842":"#f0e6d3"}}>{e.name}</div>
                      <div className="ss" style={{fontSize:11,color:"#60504a",marginTop:2}}>{e.tipped} matcher tippade</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="pf" style={{fontSize:24,fontWeight:900,color:i===0?"#f5c842":"#f0e6d3"}}>{e.points}</div>
                      <div className="ss" style={{fontSize:10,color:"#60504a"}}>poang</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESULTAT */}
        {view==="results"&&(
          <ResultsView results={results} getTeams={getTeams} getDisplay={getDisplay} placements={placements} bestThirds={bestThirds}/>
        )}

        {/* SLUTSPEL */}
        {view==="bracket"&&(
          <BracketView placements={placements} results={results} getTeams={getTeams} bestThirds={bestThirds}/>
        )}

        {/* ADMIN LOGIN */}
        {view==="adminlogin"&&(
          <div style={{maxWidth:370,margin:"60px auto",textAlign:"center"}}>
            <h2 className="pf" style={{fontSize:22,color:"#f5c842",marginBottom:20,fontWeight:700}}>Admin</h2>
            <div style={{display:"flex",gap:8}}>
              <input type="password" placeholder="Losenord" value={adminCode}
                onChange={e=>setAdminCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()} style={{flex:1}}/>
              <button className="btn" onClick={handleAdminLogin}>Logga in</button>
            </div>
          </div>
        )}

        {/* ADMIN */}
        {view==="admin"&&isAdmin&&(
          <AdminView
            results={results} deadlines={deadlines} thirdOverrides={thirdOverrides}
            tipPhase={tipPhase} setTipPhase={setTipPhase} tipGroup={tipGroup} setTipGroup={setTipGroup}
            adminTab={adminTab} setAdminTab={setAdminTab} dlInput={dlInput} setDlInput={setDlInput}
            filteredMatches={filteredMatches} getDisplay={getDisplay} getTeams={getTeams}
            handleResult={handleResult} setDeadline={setDeadline} rmDeadline={rmDeadline}
            bulkDeadline={bulkDeadline} isLocked={isLocked} fmtDl={fmtDl}
            placements={placements} bestThirds={bestThirds} handleThirdOverride={handleThirdOverride}
          />
        )}

        {view==="tips"&&!currentUser&&(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <p className="ss" style={{color:"#a09070",marginBottom:16}}>Ange ditt namn pa startsidan for att borja tippa.</p>
            <button className="btn" onClick={()=>setView("start")}>Till startsidan</button>
          </div>
        )}
      </main>
    </div>
  );
}

// RESULTAT-VY
function ResultsView({results, getTeams, getDisplay, placements, bestThirds}) {
  const [tab, setTab] = useState("groups");
  const [selGroup, setSelGroup] = useState("A");
  const [koPhase, setKoPhase] = useState("Sextondelsfinal");

  function GroupTable({group}) {
    const matches = GROUP_MATCHES.filter(m=>m.group===group);
    const standing = calcGroupStandings(group,results);
    const played = matches.filter(m=>{const r=results[m.id];return r&&r.home!=""&&r.away!="";}).length;
    return(
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{background:"rgba(245,200,66,0.08)",borderBottom:"1px solid rgba(245,200,66,0.12)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span className="pf" style={{fontSize:15,fontWeight:700,color:"#f5c842"}}>Grupp {group}</span>
          <span className="ss" style={{fontSize:11,color:"#60504a"}}>{played}/{matches.length} spelade</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                {["#","Lag","S","V","O","F","GM","MS","P"].map((h,i)=>(
                  <th key={h} style={{padding:i===0?"6px 16px":i===8?"6px 16px 6px 8px":"6px 8px",
                    textAlign:i<=1?"left":"center",color:i===8?"#f5c842":"#60504a",
                    fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,fontSize:10,
                    textTransform:"uppercase",letterSpacing:.7}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standing.map((row,i)=>{
                const adv=i<2;
                const isThird=i===2&&bestThirds.some(t=>t.team===row.team);
                const ms=matches.filter(m=>{
                  const r=results[m.id];
                  return r&&r.home!=""&&r.away!=""&&(m.home===row.team||m.away===row.team);
                });
                const pl=ms.length;
                const wins=ms.filter(m=>{const r=results[m.id];const gh=parseInt(r.home),ga=parseInt(r.away);
                  return(m.home===row.team&&gh>ga)||(m.away===row.team&&ga>gh);}).length;
                const draws=ms.filter(m=>{const r=results[m.id];return parseInt(r.home)===parseInt(r.away);}).length;
                const losses=pl-wins-draws;
                return(
                  <tr key={row.team} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",
                    background:adv?"rgba(245,200,66,0.04)":isThird?"rgba(100,160,255,0.04)":"transparent"}}>
                    <td style={{padding:"8px 16px",fontFamily:"'Source Sans 3',sans-serif",
                      color:adv?"#f5c842":isThird?"#80a8f0":"#60504a",fontWeight:700,fontSize:12}}>
                      {i+1}{adv&&" >"}{isThird&&" *"}
                    </td>
                    <td style={{padding:"8px",whiteSpace:"nowrap"}}>
                      <span className="fc">{gc(row.team)}</span>
                      <span className="ss" style={{fontSize:12,fontWeight:600,color:"#f0e6d3"}}>{dn(row.team)}</span>
                    </td>
                    <td style={{padding:"8px",textAlign:"center",color:"#a09070",fontFamily:"'Source Sans 3',sans-serif",fontSize:12}}>{pl}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#50c878",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:wins>0?700:400}}>{wins}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#a09070",fontFamily:"'Source Sans 3',sans-serif",fontSize:12}}>{draws}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#e07070",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:losses>0?700:400}}>{losses}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#a09070",fontFamily:"'Source Sans 3',sans-serif",fontSize:12}}>{row.gf}-{row.ga}</td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:row.gd!==0?700:400,
                      color:row.gd>0?"#50c878":row.gd<0?"#e07070":"#a09070"}}>{row.gd>0?"+":""}{row.gd}</td>
                    <td style={{padding:"8px 16px 8px 8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",
                      color:adv?"#f5c842":isThird?"#80a8f0":"#f0e6d3",fontWeight:700,fontSize:13}}>{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
          {matches.map(m=>{
            const r=results[m.id]; const played=r&&r.home!=""&&r.away!="";
            return(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                <span className="fc">{gc(m.home)}</span>
                <span className="ss" style={{fontSize:12,fontWeight:600,flex:1,color:"#d0c8bc",textAlign:"right"}}>{dn(m.home)}</span>
                <div style={{minWidth:60,textAlign:"center",background:played?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)",
                  border:"1px solid "+(played?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.05)"),borderRadius:6,padding:"3px 8px"}}>
                  {played?<span className="pf" style={{fontSize:13,fontWeight:700,color:"#f0e6d3"}}>{r.home} - {r.away}</span>
                    :<span className="ss" style={{fontSize:11,color:"#50403a"}}>-</span>}
                </div>
                <span className="ss" style={{fontSize:12,fontWeight:600,flex:1,color:"#d0c8bc"}}>{dn(m.away)}</span>
                <span className="fc">{gc(m.away)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const koPhases=["Sextondelsfinal","Attondelsfinaler","Kvartsfinal","Semifinal","Bronsmatch","Final"];
  const koMatches=KNOCKOUT_ALL.filter(m=>m.phase===koPhase);

  return(
    <div>
      <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:6}}>Resultat</h2>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:22}}>Officiella matchresultat och gruppstallningar</p>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:22}}>
        {[["groups","Gruppspel"],["knockout","Slutspel"],["thirds","Basta treor"]].map(([k,l])=>(
          <button key={k} className={"tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>
      {tab==="groups"&&(
        <div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:20}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} className={"gbtn"+(selGroup===g?" active":"")} onClick={()=>setSelGroup(g)}>Grupp {g}</button>
            ))}
          </div>
          <GroupTable group={selGroup}/>
          <p className="ss" style={{fontSize:11,color:"#504840",marginTop:-8}}>&gt; = vidare | * = basta trea (vidare)</p>
        </div>
      )}
      {tab==="knockout"&&(
        <div>
          <div className="scroll-x" style={{marginBottom:18}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",minWidth:"max-content"}}>
              {koPhases.map(p=><button key={p} className={"tab"+(koPhase===p?" active":"")} onClick={()=>setKoPhase(p)}>{p}</button>)}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {koMatches.map(m=>{
              const disp=getDisplay(m);
              const r=results[m.id];
              const played=r&&r.home!=""&&r.away!="";
              const gh=played?parseInt(r.home):null;
              const ga=played?parseInt(r.away):null;
              const homeWon=played&&gh>ga; const awayWon=played&&ga>gh;
              const ht=getTeams(m.id).home; const at=getTeams(m.id).away;
              return(
                <div key={m.id} style={{background:played?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.03)",
                  border:"1px solid "+(played?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)"),
                  borderRadius:11,padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
                  {ht&&<span className="fc">{gc(ht)}</span>}
                  <span className="ss" style={{fontSize:13,fontWeight:700,flex:1,textAlign:"right",
                    color:homeWon?"#f5c842":played?"#a09070":"#d0c8bc"}}>{disp.home}</span>
                  <div style={{minWidth:68,textAlign:"center",background:played?"rgba(255,255,255,0.09)":"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 10px"}}>
                    {played?<span className="pf" style={{fontSize:17,fontWeight:900,color:"#f0e6d3"}}>{gh}-{ga}</span>
                      :<span className="ss" style={{fontSize:13,color:"#50403a"}}>vs</span>}
                  </div>
                  <span className="ss" style={{fontSize:13,fontWeight:700,flex:1,
                    color:awayWon?"#f5c842":played?"#a09070":"#d0c8bc"}}>{disp.away}</span>
                  {at&&<span className="fc">{gc(at)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab==="thirds"&&(
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            De 8 basta treorna kvalificerar sig till sextondelsfinalerna. Rankade efter poang, sedan malskillnad, sedan gjorda mal.
          </p>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                  {["#","Lag","Grupp","P","MS","GM"].map((h,i)=>(
                    <th key={h} style={{padding:"6px 12px",textAlign:i<=2?"left":"center",
                      color:i===3?"#f5c842":"#60504a",fontFamily:"'Source Sans 3',sans-serif",
                      fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.7}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(GROUPS).map(g=>{
                  const st=calcGroupStandings(g,results);
                  const row=st[2]; if(!row) return null;
                  const rank=bestThirds.findIndex(t=>t.team===row.team);
                  const advances=rank>=0&&rank<8;
                  return(
                    <tr key={g} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",
                      background:advances?"rgba(80,120,220,0.06)":"transparent"}}>
                      <td style={{padding:"8px 12px",fontFamily:"'Source Sans 3',sans-serif",
                        color:advances?"#80a8f0":"#60504a",fontWeight:700,fontSize:12}}>
                        {advances?rank+1:"-"}
                      </td>
                      <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>
                        <span className="fc">{gc(row.team)}</span>
                        <span className="ss" style={{fontSize:12,fontWeight:600,color:advances?"#f0e6d3":"#a09070"}}>{dn(row.team)}</span>
                      </td>
                      <td style={{padding:"8px 12px",fontFamily:"'Source Sans 3',sans-serif",color:"#60504a",fontSize:12}}>{g}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",
                        color:advances?"#80a8f0":"#a09070",fontWeight:advances?700:400,fontSize:12}}>{row.pts}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#a09070",fontSize:12}}>{row.gd>0?"+":""}{row.gd}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#a09070",fontSize:12}}>{row.gf}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ss" style={{fontSize:11,color:"#504840",marginTop:10}}>Blaa = kvalificerad till sextondelsfinalerna</p>
        </div>
      )}
    </div>
  );
}

// ADMIN-VY
function AdminView({results,deadlines,thirdOverrides,tipPhase,setTipPhase,tipGroup,setTipGroup,
  adminTab,setAdminTab,dlInput,setDlInput,filteredMatches,getDisplay,getTeams,
  handleResult,setDeadline,rmDeadline,bulkDeadline,isLocked,fmtDl,
  placements,bestThirds,handleThirdOverride}) {

  const allTeams = Object.values(GROUPS).flat().sort((a,b)=>dn(a).localeCompare(dn(b)));

  return(
    <div>
      <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700,marginBottom:22}}>Admin</h2>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:22}}>
        {[["results","Resultat"],["thirds","Treornas matcher"],["deadlines","Deadlines"]].map(([k,l])=>(
          <button key={k} className={"tab"+(adminTab===k?" active":"")} onClick={()=>setAdminTab(k)}>{l}</button>
        ))}
      </div>

      {adminTab==="results"&&(
        <div>
          <div className="scroll-x" style={{marginBottom:11}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",minWidth:"max-content"}}>
              {PHASES.map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{p}</button>)}
            </div>
          </div>
          {tipPhase==="Grupp"&&(
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
              {Object.keys(GROUPS).map(g=>(
                <button key={g} className={"gbtn"+(tipGroup===g?" active":"")} onClick={()=>setTipGroup(g)}>Grupp {g}</button>
              ))}
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {filteredMatches.map(m=>{
              const r=results[m.id]||{home:"",away:""};
              const done=r.home!=""&&r.away!="";
              const disp=getDisplay(m);
              const ht=m.phase==="Grupp"?m.home:getTeams(m.id).home;
              const at=m.phase==="Grupp"?m.away:getTeams(m.id).away;
              return(
                <div key={m.id} style={{background:done?"rgba(80,200,120,0.06)":"rgba(255,255,255,0.04)",
                  border:"1px solid "+(done?"rgba(80,200,120,0.25)":"rgba(255,255,255,0.07)"),
                  borderRadius:9,padding:"11px 14px",display:"flex",alignItems:"center",gap:8}}>
                  {ht&&<span className="fc">{gc(ht)}</span>}
                  <span className="tn" style={{textAlign:"right"}}>{disp.home}</span>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <input type="number" min="0" max="20" value={r.home} onChange={e=>handleResult(m.id,"home",e.target.value)}/>
                    <span className="ss" style={{color:"#60504a",fontSize:11}}>-</span>
                    <input type="number" min="0" max="20" value={r.away} onChange={e=>handleResult(m.id,"away",e.target.value)}/>
                  </div>
                  <span className="tn">{disp.away}</span>
                  {at&&<span className="fc">{gc(at)}</span>}
                  {done&&<span style={{fontSize:13,color:"#50c878",fontFamily:"'Source Sans 3',sans-serif",fontWeight:700}}>OK</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adminTab==="thirds"&&(
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            Nar gruppspelet ar klart laser FIFA bracketen och bestammer vilka 8 treor som moter vilka ettorna.
            Tilldela lagnamnen nedan enligt FIFA:s officiella schema (kands 27 juni).
            Om du inte andrar nagot anvands automatisk ranking.
          </p>
          <div style={{background:"rgba(245,200,66,0.05)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:9,padding:"12px 16px",marginBottom:20}}>
            <p className="ss" style={{fontSize:12,color:"#f5c842",fontWeight:700,marginBottom:8}}>Automatisk ranking (topp 8 treor just nu):</p>
            {bestThirds.length===0
              ? <p className="ss" style={{fontSize:12,color:"#60504a"}}>Inga gruppresultat registrerade an.</p>
              : bestThirds.map((t,i)=>(
                <div key={t.team} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span className="fc">{gc(t.team)}</span>
                  <span className="ss" style={{fontSize:12,color:"#f0e6d3",fontWeight:600}}>{i+1}. {dn(t.team)}</span>
                  <span className="ss" style={{fontSize:11,color:"#60504a"}}>({t.pts}p, {t.gd>0?"+":""}{t.gd} MS) - Grupp {t.group}</span>
                </div>
              ))
            }
          </div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:14,fontWeight:700}}>
            Tilldela lag till treornas 4 sextondelsfinalsmatcher:
          </p>
          {R32_THIRDS.map(m=>(
            <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 16px",marginBottom:10}}>
              <p className="ss" style={{fontSize:12,color:"#f5c842",fontWeight:700,marginBottom:10}}>{m.id} (enligt FIFA:s schema)</p>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
                <div>
                  <p className="ss" style={{fontSize:11,color:"#60504a",marginBottom:4}}>{m.homeKey} (hemmalag / etta):</p>
                  <select value={thirdOverrides[m.homeKey]||""} onChange={e=>handleThirdOverride(m.homeKey,e.target.value)}>
                    <option value="">-- Valj lag --</option>
                    {bestThirds.map(t=><option key={t.team} value={t.team}>{dn(t.team)}</option>)}
                  </select>
                </div>
                <div className="ss" style={{fontSize:14,color:"#60504a",paddingTop:20}}>vs</div>
                <div>
                  <p className="ss" style={{fontSize:11,color:"#60504a",marginBottom:4}}>{m.awayKey} (bortalag / trea):</p>
                  <select value={thirdOverrides[m.awayKey]||""} onChange={e=>handleThirdOverride(m.awayKey,e.target.value)}>
                    <option value="">-- Valj lag --</option>
                    {bestThirds.map(t=><option key={t.team} value={t.team}>{dn(t.team)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adminTab==="deadlines"&&(
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            Satt deadline per match. Nar deadline passerar lases tipsen automatiskt.
          </p>
          <div className="scroll-x" style={{marginBottom:11}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",minWidth:"max-content"}}>
              {PHASES.map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{p}</button>)}
            </div>
          </div>
          {tipPhase==="Grupp"&&(
            <>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
                {Object.keys(GROUPS).map(g=>(
                  <button key={g} className={"gbtn"+(tipGroup===g?" active":"")} onClick={()=>setTipGroup(g)}>Grupp {g}</button>
                ))}
              </div>
              <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.14)",borderRadius:9,padding:"13px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
                <span className="ss" style={{fontSize:12,color:"#a09070"}}>Bulk - Grupp {tipGroup}:</span>
                <input type="datetime-local" value={dlInput["bulk_"+tipGroup]||""}
                  onChange={e=>setDlInput(prev=>({...prev,["bulk_"+tipGroup]:e.target.value}))}/>
                <button className="btn btn-sm" onClick={()=>{
                  const v=dlInput["bulk_"+tipGroup]; if(v) bulkDeadline(tipGroup,new Date(v).toISOString());
                }}>Tillmpa alla</button>
              </div>
            </>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredMatches.map(m=>{
              const disp=getDisplay(m); const dl=deadlines[m.id];
              const locked=isLocked(m.id);
              const curVal=dlInput[m.id]||(dl?new Date(dl).toISOString().slice(0,16):"");
              return(
                <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"11px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:8}}>
                    <span className="ss" style={{fontSize:13,fontWeight:600,color:"#f0e6d3",flex:1}}>{disp.home} - {disp.away}</span>
                    {locked&&<span className="lock-badge">Last</span>}
                    {!locked&&dl&&<span className="open-badge">Stanger {fmtDl(m.id)}</span>}
                    {!dl&&<span className="ss" style={{fontSize:10,color:"#60504a"}}>Ingen deadline</span>}
                  </div>
                  <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                    <input type="datetime-local" value={curVal}
                      onChange={e=>setDlInput(prev=>({...prev,[m.id]:e.target.value}))}/>
                    <button className="btn btn-sm" onClick={()=>{const v=dlInput[m.id];if(v)setDeadline(m.id,new Date(v).toISOString());}}>Spara</button>
                    {dl&&<button className="btn btn-sm btn-danger" onClick={()=>rmDeadline(m.id)}>Ta bort</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// SLUTSPELSTRAD
function BracketView({placements, results, getTeams, bestThirds}) {
  function TR({mid, side}) {
    const {home,away}=getTeams(mid);
    const team=side==="home"?home:away;
    const r=results[mid];
    const rh=r?parseInt(r.home):NaN; const ra=r?parseInt(r.away):NaN;
    const hasScore=!isNaN(rh)&&!isNaN(ra);
    const won=hasScore&&((side==="home"&&rh>ra)||(side==="away"&&ra>rh));
    return(
      <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",
        background:won?"rgba(245,200,66,0.1)":team?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",
        borderRadius:4,minWidth:165,border:"1px solid "+(won?"rgba(245,200,66,0.28)":"rgba(255,255,255,0.06)")}}>
        {team&&<span className="fc" style={{fontSize:8}}>{gc(team)}</span>}
        <span style={{fontSize:10,fontFamily:"'Source Sans 3',sans-serif",fontWeight:600,
          color:team?(won?"#f5c842":"#f0e6d3"):"#50403a",flex:1,overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team?dn(team):"--"}</span>
        {hasScore&&<span style={{fontSize:10,fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,
          color:won?"#f5c842":"#70605a"}}>{side==="home"?rh:ra}</span>}
      </div>
    );
  }
  function MB({mid}) {
    return <div style={{display:"flex",flexDirection:"column",gap:2}}><TR mid={mid} side="home"/><TR mid={mid} side="away"/></div>;
  }
  function Col({children,pt=0}) {
    return <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:pt}}>{children}</div>;
  }
  function H({t,gold=false}) {
    return <div style={{fontSize:8,fontFamily:"'Source Sans 3',sans-serif",color:gold?"#f5c842":"#60504a",
      textTransform:"uppercase",letterSpacing:.8,marginBottom:3,fontWeight:700}}>{t}</div>;
  }

  return(
    <div>
      <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700,marginBottom:6}}>Slutspelstrad</h2>
      <p className="ss" style={{fontSize:11,color:"#60504a",marginBottom:20}}>VM 2026: 32 lag, 5 omgangar till final</p>

      {/* Huvud-bracket */}
      <div style={{overflowX:"auto",paddingBottom:16}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:1100}}>
          <Col>
            <H t="Sextondelsfinal"/>
            {["R32_1","R32_3","R32_5","R32_7"].map(id=><div key={id} style={{marginBottom:3}}><MB mid={id}/></div>)}
          </Col>
          <Col pt={16}>
            <H t="Attondel"/>
            {["R16_1","R16_2"].map(id=><div key={id} style={{marginBottom:8}}><MB mid={id}/></div>)}
          </Col>
          <Col pt={44}>
            <H t="Kvartsfinal"/>
            <div style={{marginBottom:20}}><MB mid="QF_1"/></div>
          </Col>
          <Col pt={76}>
            <H t="Semifinal"/>
            <div style={{marginBottom:32}}><MB mid="SF_1"/></div>
          </Col>
          <Col pt={100}>
            <H t="Final" gold={true}/>
            <MB mid="FINAL"/>
            <div style={{marginTop:16}}><H t="Bronsmatch"/><MB mid="BRONS"/></div>
          </Col>
          <Col pt={76}>
            <H t="Semifinal"/>
            <MB mid="SF_2"/>
          </Col>
          <Col pt={44}>
            <H t="Kvartsfinal"/>
            <MB mid="QF_2"/>
          </Col>
          <Col pt={16}>
            <H t="Attondel"/>
            {["R16_3","R16_4"].map(id=><div key={id} style={{marginBottom:8}}><MB mid={id}/></div>)}
          </Col>
          <Col>
            <H t="Sextondelsfinal"/>
            {["R32_9","R32_11","R32_2","R32_4"].map(id=><div key={id} style={{marginBottom:3}}><MB mid={id}/></div>)}
          </Col>
        </div>
      </div>

      {/* Treornas bracket */}
      <div style={{marginTop:28,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
        <div style={{fontSize:11,fontFamily:"'Source Sans 3',sans-serif",color:"#80a8f0",fontWeight:700,
          textTransform:"uppercase",letterSpacing:.8,marginBottom:14}}>
          De 8 basta treornas del av bracketen
        </div>
        <div style={{overflowX:"auto",paddingBottom:8}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:900}}>
            <Col>
              <H t="Sextondelsfinal"/>
              {["R32_13","R32_15","R32_6","R32_8"].map(id=><div key={id} style={{marginBottom:3}}><MB mid={id}/></div>)}
            </Col>
            <Col pt={16}>
              <H t="Attondel"/>
              {["R16_7","R16_8"].map(id=><div key={id} style={{marginBottom:8}}><MB mid={id}/></div>)}
            </Col>
            <Col pt={44}>
              <H t="Kvartsfinal"/>
              <MB mid="QF_3"/>
            </Col>
            <Col pt={16}>
              <H t="Attondel"/>
              {["R16_5","R16_6"].map(id=><div key={id} style={{marginBottom:8}}><MB mid={id}/></div>)}
            </Col>
            <Col>
              <H t="Sextondelsfinal"/>
              {["R32_14","R32_16","R32_10","R32_12"].map(id=><div key={id} style={{marginBottom:3}}><MB mid={id}/></div>)}
            </Col>
          </div>
        </div>
      </div>

      {/* Grupplaceringar */}
      <div style={{marginTop:28,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
        <h3 className="ss" style={{fontSize:11,color:"#60504a",textTransform:"uppercase",letterSpacing:.9,marginBottom:14,fontWeight:700}}>Grupplaceringar</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {Object.keys(GROUPS).map(g=>{
            const e1=placements[g+"0"], e2=placements[g+"1"];
            const done=GROUP_MATCHES.filter(m=>m.group===g).every(m=>{const r=results[m.id];return r&&r.home.length>0&&r.away.length>0;});
            return(
              <div key={g} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,padding:"9px 11px"}}>
                <div className="ss" style={{fontSize:10,color:"#f5c842",fontWeight:700,marginBottom:7}}>Grupp {g} {done&&"(klar)"}</div>
                {[e1,e2].map((team,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                    <span className="ss" style={{fontSize:9,color:"#60504a",minWidth:10}}>{i+1}.</span>
                    {team&&<span className="fc" style={{fontSize:8}}>{gc(team)}</span>}
                    <span className="ss" style={{fontSize:11,color:team?"#f0e6d3":"#60504a"}}>{team?dn(team):"--"}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
