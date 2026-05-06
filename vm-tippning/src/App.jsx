import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// Lag per grupp
const GROUPS = {
  A: ["USA", "Mexiko", "Kanada", "Panama"],
  B: ["Spanien", "Uruguay", "Egypten", "Botswana"],
  C: ["Argentina", "Chile", "Peru", "Albanien"],
  D: ["Frankrike", "Belgien", "Senegal", "Elfenbenskusten"],
  E: ["Brasilien", "Colombia", "Ecuador", "Kamerun"],
  F: ["England", "Portugal", "Tunisien", "Irak"],
  G: ["Tyskland", "Nederlaenderna", "Sydkorea", "Saudiarabien"],
  H: ["Japan", "Australien", "Marocko", "Algeriet"],
  I: ["Italien", "Kroatien", "Uruguay2", "Honduras"],
  J: ["Serbien", "Ungern", "Ghana", "Kongo"],
  K: ["Iran", "Uzbekistan", "Tanzania", "Nya Zeeland"],
  L: ["Turkiet", "Ukraina", "Rumaenien", "Zambia"],
};

// Lagnamn att visa (snygga versioner)
const TEAM_DISPLAY = {
  "Nederlaenderna": "Nederlanderna",
  "Uruguay2": "Uruguay",
  "Rumaenien": "Rumanien",
};
function displayName(team) { return TEAM_DISPLAY[team] || team; }

// Landskoder fr visning
const COUNTRY_CODE = {
  "USA":"US","Mexiko":"MX","Kanada":"CA","Panama":"PA",
  "Spanien":"ES","Uruguay":"UY","Egypten":"EG","Botswana":"BW",
  "Argentina":"AR","Chile":"CL","Peru":"PE","Albanien":"AL",
  "Frankrike":"FR","Belgien":"BE","Senegal":"SN","Elfenbenskusten":"CI",
  "Brasilien":"BR","Colombia":"CO","Ecuador":"EC","Kamerun":"CM",
  "England":"EN","Portugal":"PT","Tunisien":"TN","Irak":"IQ",
  "Tyskland":"DE","Nederlaenderna":"NL","Sydkorea":"KR","Saudiarabien":"SA",
  "Japan":"JP","Australien":"AU","Marocko":"MA","Algeriet":"DZ",
  "Italien":"IT","Kroatien":"HR","Uruguay2":"UY","Honduras":"HN",
  "Serbien":"RS","Ungern":"HU","Ghana":"GH","Kongo":"CD",
  "Iran":"IR","Uzbekistan":"UZ","Tanzania":"TZ","Nya Zeeland":"NZ",
  "Turkiet":"TR","Ukraina":"UA","Rumaenien":"RO","Zambia":"ZM",
};
function getCode(team) { return COUNTRY_CODE[team] || "??"; }

// Gruppspelsmatcher
const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([group, teams]) => {
  const ms = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      ms.push({ id: group+i+j, group, home: teams[i], away: teams[j], phase: "Grupp" });
  return ms;
});

// VM 2026: 12 grupper, top 2 + 8 baesta trean = 32 lag i slutspelet
// Attondelsfinal-struktur enligt FIFA VM 2026
// homeKey/awayKey = t.ex. "A0" (etta grupp A), "A1" (tvaa grupp A), "T0".."T7" (basta treor)
const R16 = [
  {id:"R16_1",  phase:"Attondel", homeKey:"A0", awayKey:"B1"},
  {id:"R16_2",  phase:"Attondel", homeKey:"B0", awayKey:"A1"},
  {id:"R16_3",  phase:"Attondel", homeKey:"C0", awayKey:"D1"},
  {id:"R16_4",  phase:"Attondel", homeKey:"D0", awayKey:"C1"},
  {id:"R16_5",  phase:"Attondel", homeKey:"E0", awayKey:"F1"},
  {id:"R16_6",  phase:"Attondel", homeKey:"F0", awayKey:"E1"},
  {id:"R16_7",  phase:"Attondel", homeKey:"G0", awayKey:"H1"},
  {id:"R16_8",  phase:"Attondel", homeKey:"H0", awayKey:"G1"},
  {id:"R16_9",  phase:"Attondel", homeKey:"I0", awayKey:"J1"},
  {id:"R16_10", phase:"Attondel", homeKey:"J0", awayKey:"I1"},
  {id:"R16_11", phase:"Attondel", homeKey:"K0", awayKey:"L1"},
  {id:"R16_12", phase:"Attondel", homeKey:"L0", awayKey:"K1"},
  {id:"R16_13", phase:"Attondel", homeKey:"T0", awayKey:"T1"},
  {id:"R16_14", phase:"Attondel", homeKey:"T2", awayKey:"T3"},
  {id:"R16_15", phase:"Attondel", homeKey:"T4", awayKey:"T5"},
  {id:"R16_16", phase:"Attondel", homeKey:"T6", awayKey:"T7"},
];

const QF = [
  {id:"QF_1", phase:"Kvartsfinal", homeKey:"R16_1",  awayKey:"R16_2"},
  {id:"QF_2", phase:"Kvartsfinal", homeKey:"R16_3",  awayKey:"R16_4"},
  {id:"QF_3", phase:"Kvartsfinal", homeKey:"R16_5",  awayKey:"R16_6"},
  {id:"QF_4", phase:"Kvartsfinal", homeKey:"R16_7",  awayKey:"R16_8"},
  {id:"QF_5", phase:"Kvartsfinal", homeKey:"R16_9",  awayKey:"R16_10"},
  {id:"QF_6", phase:"Kvartsfinal", homeKey:"R16_11", awayKey:"R16_12"},
  {id:"QF_7", phase:"Kvartsfinal", homeKey:"R16_13", awayKey:"R16_14"},
  {id:"QF_8", phase:"Kvartsfinal", homeKey:"R16_15", awayKey:"R16_16"},
];

const SF = [
  {id:"SF_1", phase:"Semifinal", homeKey:"QF_1", awayKey:"QF_2"},
  {id:"SF_2", phase:"Semifinal", homeKey:"QF_3", awayKey:"QF_4"},
  {id:"SF_3", phase:"Semifinal", homeKey:"QF_5", awayKey:"QF_6"},
  {id:"SF_4", phase:"Semifinal", homeKey:"QF_7", awayKey:"QF_8"},
];

const LATE = [
  {id:"BRONS", phase:"Bronsmatch", homeKey:"SF_1L", awayKey:"SF_2L"},
  {id:"FINAL", phase:"Final",      homeKey:"SF_1",  awayKey:"SF_2"},
];

const KNOCKOUT_ALL = [...R16, ...QF, ...SF, ...LATE];
const PHASES = ["Grupp","Attondel","Kvartsfinal","Semifinal","Bronsmatch","Final"];
const PHASE_LABELS = {
  "Grupp":"Grupp","Attondel":"Attondelsfinaler","Kvartsfinal":"Kvartsfinal",
  "Semifinal":"Semifinal","Bronsmatch":"Bronsmatch","Final":"Final"
};

// Rakna ut gruppstaellning
function calcGroupStandings(group, results) {
  const teams = GROUPS[group];
  const s = {};
  teams.forEach(t => { s[t] = {pts:0,gf:0,ga:0,gd:0,pl:0}; });
  GROUP_MATCHES.filter(m => m.group === group).forEach(m => {
    const r = results[m.id];
    if (!r || r.home === "" || r.away === "") return;
    const gh = parseInt(r.home), ga = parseInt(r.away);
    if (isNaN(gh) || isNaN(ga)) return;
    s[m.home].pl++; s[m.away].pl++;
    s[m.home].gf+=gh; s[m.home].ga+=ga; s[m.home].gd+=gh-ga;
    s[m.away].gf+=ga; s[m.away].ga+=gh; s[m.away].gd+=ga-gh;
    if (gh > ga)      { s[m.home].pts+=3; }
    else if (gh < ga) { s[m.away].pts+=3; }
    else              { s[m.home].pts+=1; s[m.away].pts+=1; }
  });
  return teams.map(t=>({team:t,...s[t]}))
    .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));
}

// Hamta 8 baesta treor (rankade efter pts, gd, gf)
function getBestThirds(results) {
  const thirds = Object.keys(GROUPS).map(g => {
    const st = calcGroupStandings(g, results);
    return st[2] ? {...st[2], group:g} : null;
  }).filter(Boolean);
  return thirds
    .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team))
    .slice(0, 8);
}

function resolveGroupPlacements(results) {
  const p = {};
  Object.keys(GROUPS).forEach(g => {
    const st = calcGroupStandings(g, results);
    p[g+"0"] = st[0]?.team || null;
    p[g+"1"] = st[1]?.team || null;
  });
  const thirds = getBestThirds(results);
  thirds.forEach((t, i) => { p["T"+i] = t?.team || null; });
  return p;
}

function resolveKOTeams(matchId, placements, results) {
  const all = KNOCKOUT_ALL;
  const match = all.find(m => m.id === matchId);
  if (!match) return {home:null, away:null};

  function teamFromKey(key) {
    if (/^[A-L][01]$/.test(key)) return placements[key] || null;
    if (/^T[0-7]$/.test(key)) return placements[key] || null;
    if (key.endsWith("L")) return loser(key.slice(0,-1));
    return winner(key);
  }
  function winner(id) {
    const r = results[id];
    if (!r || r.home === "" || r.away === "") return null;
    const gh = parseInt(r.home), ga = parseInt(r.away);
    if (isNaN(gh) || isNaN(ga)) return null;
    const {home:ht, away:at} = resolveKOTeams(id, placements, results);
    if (gh > ga) return ht; if (ga > gh) return at; return null;
  }
  function loser(id) {
    const r = results[id];
    if (!r || r.home === "" || r.away === "") return null;
    const gh = parseInt(r.home), ga = parseInt(r.away);
    if (isNaN(gh) || isNaN(ga)) return null;
    const {home:ht, away:at} = resolveKOTeams(id, placements, results);
    if (gh > ga) return at; if (ga > gh) return ht; return null;
  }
  return {home: teamFromKey(match.homeKey), away: teamFromKey(match.awayKey)};
}

function labelFromKey(key) {
  if (/^[A-L]0$/.test(key)) return "Etta grupp "+key[0];
  if (/^[A-L]1$/.test(key)) return "Tvaa grupp "+key[0];
  if (/^T[0-7]$/.test(key)) return "Baesta trea #"+(parseInt(key[1])+1);
  if (key.endsWith("L")) return "Forlorare "+key.slice(0,-1);
  return "Vinnare "+key;
}

function calcPoints(tip, result) {
  if (!tip || !result) return 0;
  const th = parseInt(tip.home), ta = parseInt(tip.away);
  const rh = parseInt(result.home), ra = parseInt(result.away);
  if (isNaN(th)||isNaN(ta)||isNaN(rh)||isNaN(ra)) return 0;
  if (th===rh && ta===ra) return 3;
  if (Math.sign(th-ta) === Math.sign(rh-ra)) return 1;
  return 0;
}

function calcTotal(tips, results) {
  return [...GROUP_MATCHES,...KNOCKOUT_ALL]
    .reduce((s,m) => s+calcPoints(tips[m.id], results[m.id]), 0);
}

const ADMIN_CODE = "vm2026admin";

async function fbSet(docId, data) {
  await setDoc(doc(db, "vm2026", docId), data, {merge:true});
}

// ==================================================================================
export default function App() {
  const [view,         setView]         = useState("start");
  const [participants, setParticipants] = useState({});
  const [results,      setResults]      = useState({});
  const [deadlines,    setDeadlines]    = useState({});
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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db,"vm2026","participants"), snap => {
        if (snap.exists()) setParticipants(snap.data());
        setLoading(false);
      }, () => setLoading(false)),
      onSnapshot(doc(db,"vm2026","results"), snap => {
        if (snap.exists()) setResults(snap.data());
      }),
      onSnapshot(doc(db,"vm2026","deadlines"), snap => {
        if (snap.exists()) setDeadlines(snap.data());
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const placements = resolveGroupPlacements(results);
  function getTeams(matchId) { return resolveKOTeams(matchId, placements, results); }
  function getDisplay(m) {
    if (m.phase === "Grupp") return {home: displayName(m.home), away: displayName(m.away)};
    const {home, away} = getTeams(m.id);
    return {
      home: home ? displayName(home) : labelFromKey(m.homeKey),
      away: away ? displayName(away) : labelFromKey(m.awayKey)
    };
  }

  function isLocked(matchId) {
    const dl = deadlines[matchId];
    if (!dl) return false;
    return now >= new Date(dl).getTime();
  }
  function fmtDl(matchId) {
    const dl = deadlines[matchId];
    if (!dl) return null;
    return new Date(dl).toLocaleString("sv-SE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  async function handleJoin() {
    const name = nameInput.trim();
    if (!name) return;
    const upd = {...participants};
    if (!upd[name]) upd[name] = {};
    await fbSet("participants", upd);
    setCurrentUser(name);
    setView("tips");
    setNameInput("");
  }

  async function handleTip(matchId, side, val) {
    if (isLocked(matchId)) return;
    await fbSet("participants", {
      ...participants,
      [currentUser]: {
        ...(participants[currentUser]||{}),
        [matchId]: {...(participants[currentUser]?.[matchId]||{}), [side]:val}
      }
    });
  }

  async function handleSave() {
    setSaveStatus("Sparar...");
    await fbSet("participants", participants);
    setSaveStatus("Sparat!");
    setTimeout(() => setSaveStatus(""), 2500);
  }

  function handleAdminLogin() {
    if (adminCode === ADMIN_CODE) { setIsAdmin(true); setView("admin"); }
    else alert("Fel losenord");
  }

  async function handleResult(matchId, side, val) {
    await fbSet("results", {...results, [matchId]:{...(results[matchId]||{}),[side]:val}});
  }

  async function setDeadline(matchId, iso) {
    await fbSet("deadlines", {...deadlines, [matchId]:iso});
  }
  async function rmDeadline(matchId) {
    const upd = {...deadlines}; delete upd[matchId];
    await setDoc(doc(db,"vm2026","deadlines"), upd);
  }
  async function bulkDeadline(group, iso) {
    if (!iso) return;
    const upd = {...deadlines};
    GROUP_MATCHES.filter(m => m.group === group).forEach(m => { upd[m.id] = iso; });
    await fbSet("deadlines", upd);
  }

  const leaderboard = Object.entries(participants)
    .map(([name,tips]) => ({
      name,
      points: calcTotal(tips, results),
      tipped: [...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m => {
        const t = tips[m.id]; return t && t.home !== "" && t.away !== "";
      }).length
    }))
    .sort((a,b) => b.points - a.points);

  const userTips = participants[currentUser] || {};
  const totalMatches = GROUP_MATCHES.length + KNOCKOUT_ALL.length;

  function countTipped() {
    return [...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m => {
      const t = userTips[m.id]; return t && t.home !== "" && t.away !== "";
    }).length;
  }

  const filteredMatches = tipPhase === "Grupp"
    ? GROUP_MATCHES.filter(m => m.group === tipGroup)
    : KNOCKOUT_ALL.filter(m => m.phase === tipPhase);

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#0a1628",color:"#f5c842",fontFamily:"Georgia,serif",fontSize:20}}>
      Laddar VM-tippning 2026...
    </div>
  );

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@400;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a1628}
    .pf{font-family:'Playfair Display',Georgia,serif}
    .ss{font-family:'Source Sans 3',Arial,sans-serif}
    input[type=number],input[type=text],input[type=password],input[type=datetime-local]{
      background:rgba(255,255,255,0.07);border:1px solid rgba(255,200,80,0.25);
      border-radius:6px;color:#f0e6d3;padding:8px 12px;font-size:15px;outline:none;
      font-family:'Source Sans 3',sans-serif;transition:border .2s;
    }
    input[type=number]{width:56px;text-align:center}
    input[type=datetime-local]{color-scheme:dark;font-size:13px;padding:6px 10px}
    input:focus{border-color:#f5c842}
    input:disabled{opacity:.4;cursor:not-allowed}
    .btn{display:inline-block;background:#f5c842;color:#0a1628;border:none;border-radius:8px;
      padding:10px 22px;font-weight:700;font-size:14px;cursor:pointer;
      font-family:'Source Sans 3',sans-serif;transition:background .15s,transform .1s}
    .btn:hover{background:#ffd96b;transform:translateY(-1px)}
    .btn:active{transform:scale(.98)}
    .btn-sm{padding:6px 14px;font-size:12px;border-radius:6px}
    .btn-danger{background:#b83232;color:#fff}
    .btn-danger:hover{background:#d44}
    .tab{background:transparent;border:none;color:#a09070;padding:8px 14px;cursor:pointer;
      font-size:13px;border-bottom:2px solid transparent;transition:all .15s;
      font-family:'Source Sans 3',sans-serif;font-weight:600}
    .tab.active{color:#f5c842;border-bottom-color:#f5c842}
    .tab:hover:not(.active){color:#d4b870}
    .mc{background:rgba(255,255,255,0.04);border:1px solid rgba(255,200,80,0.1);
      border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:8px}
    .mc.tipped{border-color:rgba(80,200,120,0.3);background:rgba(80,200,120,0.04)}
    .mc.locked-card{border-color:rgba(180,70,70,0.25);background:rgba(140,50,50,0.05)}
    .nav-link{background:none;border:none;color:#a09070;cursor:pointer;font-size:13px;
      font-family:'Source Sans 3',sans-serif;padding:6px 11px;border-radius:6px;font-weight:600;transition:all .15s}
    .nav-link:hover{color:#f5c842;background:rgba(245,200,66,0.06)}
    .nav-link.active{color:#f5c842}
    .gbtn{background:rgba(255,255,255,0.06);color:#a09070;border:none;border-radius:5px;
      padding:5px 11px;cursor:pointer;font-weight:700;font-size:12px;
      font-family:'Source Sans 3',sans-serif;transition:all .15s}
    .gbtn.active{background:#f5c842;color:#0a1628}
    .scroll-x{overflow-x:auto}
    ::-webkit-scrollbar{height:4px;width:4px}
    ::-webkit-scrollbar-track{background:#0a1628}
    ::-webkit-scrollbar-thumb{background:#3a3020;border-radius:2px}
    .lock-badge{background:rgba(200,70,70,0.15);color:#e08080;border:1px solid rgba(200,70,70,0.22);
      border-radius:4px;padding:1px 7px;font-size:10px;font-family:'Source Sans 3',sans-serif;white-space:nowrap}
    .open-badge{background:rgba(80,200,120,0.1);color:#4dc87a;border:1px solid rgba(80,200,120,0.2);
      border-radius:4px;padding:1px 7px;font-size:10px;font-family:'Source Sans 3',sans-serif;white-space:nowrap}
    .tn{font-size:13px;font-weight:600;flex:1;font-family:'Source Sans 3',sans-serif;min-width:55px}
    .flag-code{display:inline-block;background:rgba(255,255,255,0.12);color:#f0e6d3;
      border-radius:3px;font-size:9px;font-weight:700;padding:1px 4px;font-family:'Source Sans 3',sans-serif;
      margin-right:4px;vertical-align:middle}
  `;

  function FlagCode({team}) {
    return <span className="flag-code">{getCode(team)}</span>;
  }

  function TeamLabel({team}) {
    if (!team) return <span style={{color:"#50403a"}}>--</span>;
    return <><FlagCode team={team}/>{displayName(team)}</>;
  }

  return (
    <div style={{minHeight:"100vh",background:"#0a1628",fontFamily:"Georgia,serif",color:"#f0e6d3"}}>
      <style>{css}</style>

      <header style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(245,200,66,0.15)",padding:"0 16px"}}>
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontSize:22}}>&#9917;</span>
            <span className="pf" style={{fontSize:16,color:"#f5c842",fontWeight:900}}>VM-Tippning 2026</span>
          </div>
          <nav style={{display:"flex",gap:1,flexWrap:"wrap"}}>
            <button className={"nav-link"+(view==="start"?" active":"")} onClick={()=>setView("start")}>Hem</button>
            {currentUser && <button className={"nav-link"+(view==="tips"?" active":"")} onClick={()=>setView("tips")}>Mina tips</button>}
            <button className={"nav-link"+(view==="leaderboard"?" active":"")} onClick={()=>setView("leaderboard")}>Topplista</button>
            <button className={"nav-link"+(view==="results"?" active":"")} onClick={()=>setView("results")}>Resultat</button>
            <button className={"nav-link"+(view==="bracket"?" active":"")} onClick={()=>setView("bracket")}>Slutspel</button>
            {!isAdmin && <button className={"nav-link"+(view==="adminlogin"?" active":"")} onClick={()=>setView("adminlogin")}>Admin</button>}
            {isAdmin  && <button className={"nav-link"+(view==="admin"?" active":"")} onClick={()=>setView("admin")}>Admin</button>}
          </nav>
        </div>
      </header>

      <main style={{maxWidth:980,margin:"0 auto",padding:"28px 16px 80px"}}>

        {/* START */}
        {view==="start" && (
          <div style={{textAlign:"center",paddingTop:28}}>
            <div style={{fontSize:56,marginBottom:14}}>&#127942;</div>
            <h1 className="pf" style={{fontSize:42,color:"#f5c842",fontWeight:900,lineHeight:1.1,marginBottom:9}}>FIFA VM 2026</h1>
            <p className="ss" style={{fontSize:17,color:"#a09070",marginBottom:5}}>USA &middot; Mexiko &middot; Kanada</p>
            <p className="ss" style={{fontSize:13,color:"#60504a",marginBottom:40}}>11 juni - 19 juli 2026</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:44}}>
              {[
                {icon:"&#9917;",label:"104 matcher",sub:"48 grupp + 56 slutspel"},
                {icon:"&#128101;",label:Object.keys(participants).length+" deltagare",sub:"registrerade tippare"},
                {icon:"&#127941;",label:"Pongsystem",sub:"3p ratt, 1p ratt utfall"},
              ].map(c=>(
                <div key={c.label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.12)",borderRadius:12,padding:"16px 24px",minWidth:140}}>
                  <div style={{fontSize:28,marginBottom:7}} dangerouslySetInnerHTML={{__html:c.icon}}/>
                  <div className="pf" style={{fontSize:16,color:"#f0e6d3",fontWeight:700}}>{c.label}</div>
                  <div className="ss" style={{fontSize:11,color:"#60504a",marginTop:3}}>{c.sub}</div>
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
              {Object.keys(participants).length>0 && (
                <p className="ss" style={{fontSize:11,color:"#60504a",marginTop:9}}>
                  Befintliga: {Object.keys(participants).join(", ")}
                </p>
              )}
            </div>
            <div style={{background:"rgba(245,200,66,0.05)",border:"1px solid rgba(245,200,66,0.14)",borderRadius:9,padding:"13px 17px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
              <p className="ss" style={{fontSize:11,color:"#a09070",lineHeight:1.8}}>
                <strong style={{color:"#f5c842"}}>Pongsystem:</strong><br/>
                3 pong - Exakt ratt resultat<br/>
                1 pong - Ratt utfall (vinst / oavgjort / forlust)<br/>
                0 pong - Fel &nbsp;&nbsp; Last = kan ej andras
              </p>
            </div>
          </div>
        )}

        {/* TIPS */}
        {view==="tips" && currentUser && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <div>
                <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700}}>{currentUser}s tips</h2>
                <p className="ss" style={{fontSize:12,color:"#60504a",marginTop:3}}>{countTipped()} / {totalMatches} matcher tippade</p>
              </div>
              <div style={{display:"flex",gap:9,alignItems:"center"}}>
                {saveStatus && <span className="ss" style={{fontSize:13,color:"#50c878"}}>{saveStatus}</span>}
                <button className="btn btn-sm" onClick={handleSave}>Spara</button>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:4,height:5,marginBottom:22,overflow:"hidden"}}>
              <div style={{background:"#f5c842",height:"100%",width:(countTipped()/totalMatches*100)+"%",transition:"width .3s",borderRadius:4}}/>
            </div>
            <div className="scroll-x" style={{marginBottom:12}}>
              <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",minWidth:"max-content"}}>
                {PHASES.map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{PHASE_LABELS[p]}</button>)}
              </div>
            </div>
            {tipPhase==="Grupp" && (
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
                {Object.keys(GROUPS).map(g=>(
                  <button key={g} className={"gbtn"+(tipGroup===g?" active":"")} onClick={()=>setTipGroup(g)}>Grupp {g}</button>
                ))}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {filteredMatches.map(m=>{
                const tip = userTips[m.id] || {home:"",away:""};
                const tipped = tip.home !== "" && tip.away !== "";
                const locked = isLocked(m.id);
                const dl = fmtDl(m.id);
                const hasResult = results[m.id] && results[m.id].home !== "" && results[m.id].away !== "";
                const pts = calcPoints(tip, results[m.id]);
                const disp = getDisplay(m);
                return (
                  <div key={m.id} className={"mc"+(locked?" locked-card":tipped?" tipped":"")}>
                    <span className="tn" style={{textAlign:"right"}}><TeamLabel team={m.phase==="Grupp"?m.home:getTeams(m.id).home}/></span>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <input type="number" min="0" max="20" value={tip.home} disabled={locked}
                          onChange={e=>handleTip(m.id,"home",e.target.value)}/>
                        <span className="ss" style={{color:"#504040",fontSize:11}}>-</span>
                        <input type="number" min="0" max="20" value={tip.away} disabled={locked}
                          onChange={e=>handleTip(m.id,"away",e.target.value)}/>
                      </div>
                      {locked && <span className="lock-badge">Last</span>}
                      {!locked && dl && <span className="open-badge">Stanger {dl}</span>}
                    </div>
                    <span className="tn"><TeamLabel team={m.phase==="Grupp"?m.away:getTeams(m.id).away}/></span>
                    {hasResult && (
                      <span className="ss" style={{fontSize:12,fontWeight:700,minWidth:26,textAlign:"center",
                        color:pts===3?"#50c878":pts===1?"#f5c842":"#a05050"}}>{pts}p</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TOPPLISTA */}
        {view==="leaderboard" && (
          <div>
            <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:5}}>Topplista</h2>
            <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:26}}>Uppdateras i realtid nar resultat registreras</p>
            {leaderboard.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0",color:"#60504a"}}>
                <p className="ss" style={{fontSize:15}}>Inga tippare annu - var forst!</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {leaderboard.map((e,i)=>(
                  <div key={e.name} style={{
                    background:i===0?"rgba(245,200,66,0.08)":"rgba(255,255,255,0.04)",
                    border:"1px solid "+(i===0?"rgba(245,200,66,0.3)":"rgba(255,255,255,0.07)"),
                    borderRadius:11,padding:"13px 20px",display:"flex",alignItems:"center",gap:14
                  }}>
                    <span className="ss" style={{fontSize:i<3?20:14,minWidth:30,textAlign:"center",fontWeight:700,color:"#f5c842"}}>
                      {i===0?"#1":i===1?"#2":i===2?"#3":"#"+(i+1)}
                    </span>
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
        {view==="results" && (
          <ResultsView results={results} getTeams={getTeams} getDisplay={getDisplay} placements={placements}/>
        )}

        {/* SLUTSPEL */}
        {view==="bracket" && (
          <BracketView placements={placements} results={results} getTeams={getTeams}/>
        )}

        {/* ADMIN LOGIN */}
        {view==="adminlogin" && (
          <div style={{maxWidth:370,margin:"60px auto",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:16}}>&#128272;</div>
            <h2 className="pf" style={{fontSize:22,color:"#f5c842",marginBottom:20,fontWeight:700}}>Adminatkomst</h2>
            <div style={{display:"flex",gap:8}}>
              <input type="password" placeholder="Losenord" value={adminCode}
                onChange={e=>setAdminCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()} style={{flex:1}}/>
              <button className="btn" onClick={handleAdminLogin}>Logga in</button>
            </div>
          </div>
        )}

        {/* ADMIN */}
        {view==="admin" && isAdmin && (
          <AdminView
            results={results} deadlines={deadlines} tipPhase={tipPhase} setTipPhase={setTipPhase}
            tipGroup={tipGroup} setTipGroup={setTipGroup} adminTab={adminTab} setAdminTab={setAdminTab}
            dlInput={dlInput} setDlInput={setDlInput} filteredMatches={filteredMatches}
            getDisplay={getDisplay} handleResult={handleResult} setDeadline={setDeadline}
            rmDeadline={rmDeadline} bulkDeadline={bulkDeadline} isLocked={isLocked} fmtDl={fmtDl}
            placements={placements} getTeams={getTeams}
          />
        )}

        {view==="tips" && !currentUser && (
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
function ResultsView({results, getTeams, getDisplay, placements}) {
  const [tab, setTab] = useState("groups");
  const [selGroup, setSelGroup] = useState("A");
  const [koPhase, setKoPhase] = useState("Attondel");

  function GroupTable({group}) {
    const matches = GROUP_MATCHES.filter(m => m.group === group);
    const standing = calcGroupStandings(group, results);
    const played = matches.filter(m => {
      const r = results[m.id]; return r && r.home !== "" && r.away !== "";
    }).length;
    return (
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
              {standing.map((row,i) => {
                const advances = i < 2;
                const ms = matches.filter(m => {
                  const r = results[m.id];
                  return r && r.home !== "" && r.away !== "" && (m.home===row.team||m.away===row.team);
                });
                const pl = ms.length;
                const wins = ms.filter(m => {
                  const r=results[m.id]; const gh=parseInt(r.home),ga=parseInt(r.away);
                  return (m.home===row.team&&gh>ga)||(m.away===row.team&&ga>gh);
                }).length;
                const draws = ms.filter(m => {
                  const r=results[m.id]; return parseInt(r.home)===parseInt(r.away);
                }).length;
                const losses = pl-wins-draws;
                return (
                  <tr key={row.team} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:advances?"rgba(245,200,66,0.04)":"transparent"}}>
                    <td style={{padding:"8px 16px",fontFamily:"'Source Sans 3',sans-serif",color:advances?"#f5c842":"#60504a",fontWeight:700,fontSize:12}}>
                      {i+1}{advances&&<span style={{marginLeft:3,fontSize:9}}> adv</span>}
                    </td>
                    <td style={{padding:"8px",whiteSpace:"nowrap"}}>
                      <span className="flag-code">{getCode(row.team)}</span>
                      <span className="ss" style={{fontSize:12,fontWeight:600,color:"#f0e6d3"}}>{displayName(row.team)}</span>
                    </td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#a09070",fontSize:12}}>{pl}</td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#50c878",fontSize:12,fontWeight:wins>0?700:400}}>{wins}</td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#a09070",fontSize:12}}>{draws}</td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#e07070",fontSize:12,fontWeight:losses>0?700:400}}>{losses}</td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:"#a09070",fontSize:12}}>{row.gf}-{row.ga}</td>
                    <td style={{padding:"8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:row.gd>0?"#50c878":row.gd<0?"#e07070":"#a09070",fontSize:12,fontWeight:row.gd!==0?700:400}}>{row.gd>0?"+":""}{row.gd}</td>
                    <td style={{padding:"8px 16px 8px 8px",textAlign:"center",fontFamily:"'Source Sans 3',sans-serif",color:advances?"#f5c842":"#f0e6d3",fontWeight:700,fontSize:13}}>{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
          {matches.map(m => {
            const r = results[m.id];
            const played = r && r.home !== "" && r.away !== "";
            return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 2px"}}>
                <span className="flag-code">{getCode(m.home)}</span>
                <span className="ss" style={{fontSize:12,fontWeight:600,flex:1,color:"#d0c8bc",textAlign:"right"}}>{displayName(m.home)}</span>
                <div style={{minWidth:64,textAlign:"center",background:played?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)",border:"1px solid "+(played?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.05)"),borderRadius:6,padding:"3px 10px"}}>
                  {played
                    ? <span className="pf" style={{fontSize:14,fontWeight:700,color:"#f0e6d3"}}>{r.home} - {r.away}</span>
                    : <span className="ss" style={{fontSize:11,color:"#50403a"}}>-</span>}
                </div>
                <span className="ss" style={{fontSize:12,fontWeight:600,flex:1,color:"#d0c8bc"}}>{displayName(m.away)}</span>
                <span className="flag-code">{getCode(m.away)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const koPhases = ["Attondel","Kvartsfinal","Semifinal","Bronsmatch","Final"];
  const koMatches = KNOCKOUT_ALL.filter(m => m.phase === koPhase);

  return (
    <div>
      <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:6}}>Resultat</h2>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:22}}>Officiella matchresultat och gruppstallningar</p>
      <div style={{display:"flex",gap:0,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:22}}>
        {[["groups","Gruppspel"],["knockout","Slutspel"]].map(([k,l])=>(
          <button key={k} className={"tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>
      {tab==="groups" && (
        <div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:20}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} className={"gbtn"+(selGroup===g?" active":"")} onClick={()=>setSelGroup(g)}>Grupp {g}</button>
            ))}
          </div>
          <GroupTable group={selGroup}/>
          <p className="ss" style={{fontSize:11,color:"#504840",marginTop:-8}}>adv = kvalificerar till attondelsfinalen (topp 2)</p>
        </div>
      )}
      {tab==="knockout" && (
        <div>
          <div className="scroll-x" style={{marginBottom:18}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",minWidth:"max-content"}}>
              {koPhases.map(p=>(
                <button key={p} className={"tab"+(koPhase===p?" active":"")} onClick={()=>setKoPhase(p)}>{PHASE_LABELS[p]}</button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {koMatches.map(m=>{
              const disp = getDisplay(m);
              const r = results[m.id];
              const played = r && r.home !== "" && r.away !== "";
              const gh = played ? parseInt(r.home) : null;
              const ga = played ? parseInt(r.away) : null;
              const homeWon = played && gh > ga;
              const awayWon = played && ga > gh;
              const ht = getTeams(m.id).home;
              const at = getTeams(m.id).away;
              return (
                <div key={m.id} style={{background:played?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.03)",border:"1px solid "+(played?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)"),borderRadius:11,padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
                  <span className="flag-code">{getCode(ht)}</span>
                  <span className="ss" style={{fontSize:13,fontWeight:700,flex:1,textAlign:"right",color:homeWon?"#f5c842":played?"#a09070":"#d0c8bc"}}>{disp.home}</span>
                  <div style={{minWidth:72,textAlign:"center",background:played?"rgba(255,255,255,0.09)":"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 12px"}}>
                    {played
                      ? <span className="pf" style={{fontSize:18,fontWeight:900,color:"#f0e6d3"}}>{gh}-{ga}</span>
                      : <span className="ss" style={{fontSize:13,color:"#50403a"}}>vs</span>}
                  </div>
                  <span className="ss" style={{fontSize:13,fontWeight:700,flex:1,color:awayWon?"#f5c842":played?"#a09070":"#d0c8bc"}}>{disp.away}</span>
                  <span className="flag-code">{getCode(at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ADMIN-VY
function AdminView({results,deadlines,tipPhase,setTipPhase,tipGroup,setTipGroup,adminTab,setAdminTab,
  dlInput,setDlInput,filteredMatches,getDisplay,handleResult,setDeadline,rmDeadline,
  bulkDeadline,isLocked,fmtDl,placements,getTeams}) {

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:22}}>
        <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700}}>Administrera VM-tippning</h2>
      </div>
      <div style={{display:"flex",gap:0,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:22}}>
        {[["results","Resultat"],["deadlines","Deadlines"],["bracket","Trad"]].map(([k,l])=>(
          <button key={k} className={"tab"+(adminTab===k?" active":"")} onClick={()=>setAdminTab(k)}>{l}</button>
        ))}
      </div>

      {adminTab==="results" && (
        <div>
          <div className="scroll-x" style={{marginBottom:11}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",minWidth:"max-content"}}>
              {PHASES.map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{PHASE_LABELS[p]}</button>)}
            </div>
          </div>
          {tipPhase==="Grupp" && (
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
              {Object.keys(GROUPS).map(g=>(
                <button key={g} className={"gbtn"+(tipGroup===g?" active":"")} onClick={()=>setTipGroup(g)}>Grupp {g}</button>
              ))}
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {filteredMatches.map(m=>{
              const r = results[m.id] || {home:"",away:""};
              const done = r.home !== "" && r.away !== "";
              const disp = getDisplay(m);
              const ht = m.phase==="Grupp" ? m.home : getTeams(m.id).home;
              const at = m.phase==="Grupp" ? m.away : getTeams(m.id).away;
              return (
                <div key={m.id} style={{background:done?"rgba(80,200,120,0.06)":"rgba(255,255,255,0.04)",border:"1px solid "+(done?"rgba(80,200,120,0.25)":"rgba(255,255,255,0.07)"),borderRadius:9,padding:"11px 14px",display:"flex",alignItems:"center",gap:8}}>
                  <span className="flag-code">{getCode(ht)}</span>
                  <span className="tn" style={{textAlign:"right"}}>{disp.home}</span>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <input type="number" min="0" max="20" value={r.home} onChange={e=>handleResult(m.id,"home",e.target.value)}/>
                    <span className="ss" style={{color:"#60504a",fontSize:11}}>-</span>
                    <input type="number" min="0" max="20" value={r.away} onChange={e=>handleResult(m.id,"away",e.target.value)}/>
                  </div>
                  <span className="tn">{disp.away}</span>
                  <span className="flag-code">{getCode(at)}</span>
                  {done && <span style={{fontSize:15}}>OK</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adminTab==="deadlines" && (
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            Satt deadline per match. Nar deadline passerar lases tipsen automatiskt.
          </p>
          <div className="scroll-x" style={{marginBottom:11}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",minWidth:"max-content"}}>
              {PHASES.map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{PHASE_LABELS[p]}</button>)}
            </div>
          </div>
          {tipPhase==="Grupp" && (
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
                  const v=dlInput["bulk_"+tipGroup];
                  if(v) bulkDeadline(tipGroup, new Date(v).toISOString());
                }}>Tillmpa alla Grupp {tipGroup}</button>
              </div>
            </>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredMatches.map(m=>{
              const disp = getDisplay(m);
              const dl = deadlines[m.id];
              const locked = isLocked(m.id);
              const curVal = dlInput[m.id]||(dl?new Date(dl).toISOString().slice(0,16):"");
              return (
                <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"11px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:8}}>
                    <span className="ss" style={{fontSize:13,fontWeight:600,color:"#f0e6d3",flex:1}}>{disp.home} - {disp.away}</span>
                    {locked && <span className="lock-badge">Last</span>}
                    {!locked && dl && <span className="open-badge">Stanger {fmtDl(m.id)}</span>}
                    {!dl && <span className="ss" style={{fontSize:10,color:"#60504a"}}>Ingen deadline</span>}
                  </div>
                  <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                    <input type="datetime-local" value={curVal}
                      onChange={e=>setDlInput(prev=>({...prev,[m.id]:e.target.value}))}/>
                    <button className="btn btn-sm" onClick={()=>{
                      const v=dlInput[m.id]; if(v) setDeadline(m.id, new Date(v).toISOString());
                    }}>Spara</button>
                    {dl && <button className="btn btn-sm btn-danger" onClick={()=>rmDeadline(m.id)}>Ta bort</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adminTab==="bracket" && (
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18}}>
            Lag placeras in automatiskt fran gruppresultaten. De 8 basta treorna kvalificerar till slutspelet.
          </p>
          <BracketView placements={placements} results={results} getTeams={(id)=>resolveKOTeams(id,placements,results)}/>
        </div>
      )}
    </div>
  );
}

// SLUTSPELSTRAD
function BracketView({placements, results, getTeams}) {
  function TeamRow({matchId, side}) {
    const {home, away} = getTeams(matchId);
    const team = side==="home" ? home : away;
    const r = results[matchId];
    const rh = r ? parseInt(r.home) : NaN;
    const ra = r ? parseInt(r.away) : NaN;
    const hasScore = !isNaN(rh) && !isNaN(ra);
    const won = hasScore && ((side==="home"&&rh>ra)||(side==="away"&&ra>rh));
    return (
      <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",
        background:won?"rgba(245,200,66,0.1)":team?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",
        borderRadius:5,minWidth:170,border:"1px solid "+(won?"rgba(245,200,66,0.28)":"rgba(255,255,255,0.06)")}}>
        <span className="flag-code" style={{fontSize:9}}>{getCode(team)}</span>
        <span style={{fontSize:11,fontFamily:"'Source Sans 3',sans-serif",fontWeight:600,
          color:team?(won?"#f5c842":"#f0e6d3"):"#50403a",flex:1,overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team?displayName(team):"--"}</span>
        {hasScore && <span style={{fontSize:11,fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,
          color:won?"#f5c842":"#70605a",minWidth:12,textAlign:"right"}}>{side==="home"?rh:ra}</span>}
      </div>
    );
  }

  function MatchBox({matchId}) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <TeamRow matchId={matchId} side="home"/>
        <TeamRow matchId={matchId} side="away"/>
      </div>
    );
  }

  function Col({children, paddingTop=0}) {
    return <div style={{display:"flex",flexDirection:"column",gap:8,paddingTop}}>{children}</div>;
  }

  function Hdr({txt, gold=false}) {
    return <div style={{fontSize:9,fontFamily:"'Source Sans 3',sans-serif",color:gold?"#f5c842":"#60504a",
      textTransform:"uppercase",letterSpacing:.9,marginBottom:4,fontWeight:700}}>{txt}</div>;
  }

  return (
    <div>
      <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700,marginBottom:20}}>Slutspelstrad</h2>

      <div style={{overflowX:"auto",paddingBottom:16}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",minWidth:1100}}>

          {/* Attondel vanster */}
          <Col>
            <Hdr txt="Attondel"/>
            {["R16_1","R16_3","R16_5","R16_7"].map(id=><div key={id} style={{marginBottom:4}}><MatchBox matchId={id}/></div>)}
          </Col>

          {/* Kvartsfinal vanster */}
          <Col paddingTop={20}>
            <Hdr txt="Kvartsfinal"/>
            {["QF_1","QF_2"].map(id=><div key={id} style={{marginBottom:10}}><MatchBox matchId={id}/></div>)}
          </Col>

          {/* Semifinal vanster */}
          <Col paddingTop={52}>
            <Hdr txt="Semifinal"/>
            <div style={{marginBottom:28}}><MatchBox matchId="SF_1"/></div>
          </Col>

          {/* Final + Brons */}
          <Col paddingTop={90}>
            <Hdr txt="Final" gold={true}/>
            <MatchBox matchId="FINAL"/>
            <div style={{marginTop:20}}><Hdr txt="Bronsmatch"/><MatchBox matchId="BRONS"/></div>
          </Col>

          {/* Semifinal hoger */}
          <Col paddingTop={52}>
            <Hdr txt="Semifinal"/>
            <div style={{marginBottom:28}}><MatchBox matchId="SF_2"/></div>
          </Col>

          {/* Kvartsfinal hoger */}
          <Col paddingTop={20}>
            <Hdr txt="Kvartsfinal"/>
            {["QF_3","QF_4"].map(id=><div key={id} style={{marginBottom:10}}><MatchBox matchId={id}/></div>)}
          </Col>

          {/* Attondel hoger */}
          <Col>
            <Hdr txt="Attondel"/>
            {["R16_9","R16_10","R16_11","R16_12"].map(id=><div key={id} style={{marginBottom:4}}><MatchBox matchId={id}/></div>)}
          </Col>

        </div>

        {/* Trea-bracket */}
        <div style={{marginTop:32,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
          <div style={{fontSize:11,fontFamily:"'Source Sans 3',sans-serif",color:"#a09070",fontWeight:700,
            textTransform:"uppercase",letterSpacing:.8,marginBottom:14}}>
            De 8 basta treorna (matcher i slutspelet)
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            {["R16_5","R16_6","R16_7","R16_8","R16_13","R16_14","R16_15","R16_16"].map(id=>(
              <div key={id}><MatchBox matchId={id}/></div>
            ))}
          </div>
        </div>
      </div>

      {/* Grupplaceringar */}
      <div style={{marginTop:30,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:22}}>
        <h3 className="ss" style={{fontSize:11,color:"#60504a",textTransform:"uppercase",letterSpacing:.9,marginBottom:14,fontWeight:700}}>Grupplaceringar</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {Object.keys(GROUPS).map(g=>{
            const e1=placements[g+"0"], e2=placements[g+"1"];
            const done = GROUP_MATCHES.filter(m=>m.group===g)
              .every(m=>{ const r=results[m.id]; return r&&r.home.length>0&&r.away.length>0; });
            return (
              <div key={g} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,padding:"9px 11px"}}>
                <div className="ss" style={{fontSize:10,color:"#f5c842",fontWeight:700,marginBottom:7}}>
                  Grupp {g} {done&&"(klar)"}
                </div>
                {[e1,e2].map((team,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                    <span className="ss" style={{fontSize:9,color:"#60504a",minWidth:10}}>{i+1}.</span>
                    <span className="flag-code" style={{fontSize:9}}>{getCode(team)}</span>
                    <span className="ss" style={{fontSize:11,color:team?"#f0e6d3":"#60504a"}}>{team?displayName(team):"--"}</span>
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
