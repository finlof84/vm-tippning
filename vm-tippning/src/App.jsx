import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc, increment, updateDoc, getDoc } from "firebase/firestore";

// Ratta grupper enligt FIFA VM 2026 (efter alla kval klara april 2026)
const GROUPS = {
  A: ["Mexiko", "Sydafrika", "Sydkorea", "Tjeckien"],
  B: ["Kanada", "Schweiz", "Qatar", "Bosnien"],
  C: ["Brasilien", "Marocko", "Skottland", "Haiti"],
  D: ["USA", "Australien", "Paraguay", "Turkiet"],
  E: ["Tyskland", "Ecuador", "Elfenbenskusten", "Curacao"],
  F: ["Nederlanderna", "Japan", "Tunisien", "Sverige"],
  G: ["Belgien", "Iran", "Egypten", "Nya Zeeland"],
  H: ["Spanien", "Uruguay", "Saudiarabien", "Kap Verde"],
  I: ["Frankrike", "Senegal", "Norge", "Irak"],
  J: ["Argentina", "Osterrike", "Algeriet", "Jordanien"],
  K: ["Portugal", "Colombia", "Uzbekistan", "DR Kongo"],
  L: ["England", "Kroatien", "Panama", "Ghana"],
};

// Matchpar per omgång inom varje grupp
// Baserat pa officiellt FIFA VM 2026 schema:
// Omgång 1: match 1 (lag0 vs lag1) och match 2 (lag2 vs lag3)
// Omgång 2: match 3 (lag0 vs lag2) och match 4 (lag1 vs lag3)  
// Omgång 3: match 5 (lag0 vs lag3) och match 6 (lag1 vs lag2) - spelas samtidigt
const ROUND_MAP = { "01":1, "23":1, "02":2, "13":2, "03":3, "12":3 };

const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([group, teams]) => {
  const ms = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) {
      const key = ""+i+j;
      const round = ROUND_MAP[key] || 1;
      ms.push({ id: group+i+j, group, home: teams[i], away: teams[j], phase: "Grupp", round });
    }
  return ms;
});

function getMatchesForRound(round) {
  return GROUP_MATCHES.filter(m => m.round === round);
}

const CC = {
  "Mexiko":"MX","Sydafrika":"ZA","Sydkorea":"KR","Tjeckien":"CZ",
  "Kanada":"CA","Schweiz":"CH","Qatar":"QA","Bosnien":"BA",
  "Brasilien":"BR","Marocko":"MA","Skottland":"GB-SCT","Haiti":"HT",
  "USA":"US","Australien":"AU","Paraguay":"PY","Turkiet":"TR",
  "Tyskland":"DE","Ecuador":"EC","Elfenbenskusten":"CI","Curacao":"CW",
  "Nederlanderna":"NL","Japan":"JP","Tunisien":"TN","Sverige":"SE",
  "Belgien":"BE","Iran":"IR","Egypten":"EG","Nya Zeeland":"NZ",
  "Spanien":"ES","Uruguay":"UY","Saudiarabien":"SA","Kap Verde":"CV",
  "Frankrike":"FR","Senegal":"SN","Norge":"NO","Irak":"IQ",
  "Argentina":"AR","Osterrike":"AT","Algeriet":"DZ","Jordanien":"JO",
  "Portugal":"PT","Colombia":"CO","Uzbekistan":"UZ","DR Kongo":"CD",
  "England":"EN","Kroatien":"HR","Panama":"PA","Ghana":"GH",
};
function gc(team) { return CC[team] || "??"; }
function dn(team) { return team || "--"; }

// Sextondelsfinal (Round of 32) - 16 matcher
// 8 fasta etta vs tvåå-matcher + 8 etta vs trea-matcher
// Baserat pa FIFA VM 2026 officiellt schema (ESPN/Al Jazeera)
// Trea-platser (THIRD_1..8) fylls i av admin när FIFA bestammer bracketen (27 juni)
const R32_FIXED = [
  // Etta vs Två - fasta matchningår
  {id:"R32_1",  phase:"Sextondelsfinal", homeKey:"C0", awayKey:"F1"},  // jun 29
  {id:"R32_2",  phase:"Sextondelsfinal", homeKey:"F0", awayKey:"C1"},  // jun 29
  {id:"R32_3",  phase:"Sextondelsfinal", homeKey:"E1", awayKey:"I1"},  // jun 30 (två vs två)
  {id:"R32_4",  phase:"Sextondelsfinal", homeKey:"H0", awayKey:"J1"},  // jul 2
  {id:"R32_5",  phase:"Sextondelsfinal", homeKey:"B0", awayKey:"G1"},  // jul 2
  {id:"R32_6",  phase:"Sextondelsfinal", homeKey:"J0", awayKey:"H1"},  // jul 3
  {id:"R32_7",  phase:"Sextondelsfinal", homeKey:"K0", awayKey:"B1"},  // jul 3
  {id:"R32_8",  phase:"Sextondelsfinal", homeKey:"A1", awayKey:"D1"},  // jul 3 (två vs två)
];
// Etta vs Trea - admin placerar rätt trea när FIFA laser bracketen
const R32_THIRDS = [
  {id:"R32_9",  phase:"Sextondelsfinal", homeKey:"E0",  awayKey:"THIRD_1", thirdInfo:"Trea från grupp A/B/C/D/F"},  // jun 29
  {id:"R32_10", phase:"Sextondelsfinal", homeKey:"I0",  awayKey:"THIRD_2", thirdInfo:"Trea från grupp C/D/F/G/H"},  // jun 30
  {id:"R32_11", phase:"Sextondelsfinal", homeKey:"A0",  awayKey:"THIRD_3", thirdInfo:"Trea från grupp C/E/F/H/I"},  // jun 30
  {id:"R32_12", phase:"Sextondelsfinal", homeKey:"L0",  awayKey:"THIRD_4", thirdInfo:"Trea från grupp E/H/I/J/K"},  // jul 1
  {id:"R32_13", phase:"Sextondelsfinal", homeKey:"G0",  awayKey:"THIRD_5", thirdInfo:"Trea från grupp A/E/H/I/J"},  // jul 1
  {id:"R32_14", phase:"Sextondelsfinal", homeKey:"D0",  awayKey:"THIRD_6", thirdInfo:"Trea från grupp B/E/F/I/J"},  // jul 1
  {id:"R32_15", phase:"Sextondelsfinal", homeKey:"K0",  awayKey:"THIRD_7", thirdInfo:"Trea från grupp D/E/I/J/L"},  // jul 2 -- wait K0 already used
  {id:"R32_16", phase:"Sextondelsfinal", homeKey:"B1",  awayKey:"THIRD_8", thirdInfo:"Trea (okänd matchning)"},
];
const R32 = [...R32_FIXED, ...R32_THIRDS];

const R16 = [
  // Spain-halvan: vinnare fran par av R32
  {id:"R16_1", phase:"Attondelsfinaler", homeKey:"R32_1",  awayKey:"R32_9"},   // 1F/2C vs 1E/trea
  {id:"R16_2", phase:"Attondelsfinaler", homeKey:"R32_2",  awayKey:"R32_10"},  // 1C/2F vs 1I/trea
  {id:"R16_3", phase:"Attondelsfinaler", homeKey:"R32_3",  awayKey:"R32_11"},  // 2E/2I vs 1G/trea
  {id:"R16_4", phase:"Attondelsfinaler", homeKey:"R32_4",  awayKey:"R32_12"},  // 1H/2J vs 1D/trea
  // Argentina-halvan
  {id:"R16_5", phase:"Attondelsfinaler", homeKey:"R32_5",  awayKey:"R32_13"},  // 2A/2B vs 1A/trea
  {id:"R16_6", phase:"Attondelsfinaler", homeKey:"R32_6",  awayKey:"R32_14"},  // 1J/2H vs 1L/trea
  {id:"R16_7", phase:"Attondelsfinaler", homeKey:"R32_7",  awayKey:"R32_15"},  // 2K/2L vs 1B/trea
  {id:"R16_8", phase:"Attondelsfinaler", homeKey:"R32_8",  awayKey:"R32_16"},  // 2D/2G vs 1K/trea
];
const QF = [
  {id:"QF_1", phase:"Kvartsfinal", homeKey:"R16_1", awayKey:"R16_2"},  // Spain-halvan
  {id:"QF_2", phase:"Kvartsfinal", homeKey:"R16_3", awayKey:"R16_4"},  // Spain-halvan
  {id:"QF_3", phase:"Kvartsfinal", homeKey:"R16_5", awayKey:"R16_6"},  // Argentina-halvan
  {id:"QF_4", phase:"Kvartsfinal", homeKey:"R16_7", awayKey:"R16_8"},  // Argentina-halvan
];
const SF = [
  {id:"SF_1", phase:"Semifinal", homeKey:"QF_1", awayKey:"QF_2"},  // Spain-halvan -> Dallas 14 jul
  {id:"SF_2", phase:"Semifinal", homeKey:"QF_3", awayKey:"QF_4"},  // Argentina-halvan -> Atlanta 15 jul
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
    .map(g => { const st=calcGroupStandings(g,results); return st[2]?{...st[2],group:g}:null; })
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
  // Treornas placering i slutspelet bestams av FIFA (admin anger i adminpanelen)
  return p;
}

function resolveKOTeams(matchId, placements, results, thirdOverrides, matchOverrides={}) {
  const all = KNOCKOUT_ALL;
  const match = all.find(m => m.id === matchId);
  if (!match) return {home:null,away:null};
  function teamFromKey(key, side) {
    // Manual override takes priority
    if(side && matchOverrides && matchOverrides[matchId+"_"+side]) return matchOverrides[matchId+"_"+side];
    if (/^[A-L][01]$/.test(key)) return placements[key]||null;
    if (/^THIRD_[1-8]$/.test(key)) return (thirdOverrides&&thirdOverrides[key])||null;
    if (key.endsWith("L")) return loser(key.slice(0,-1));
    return winner(key);
  }
  function winner(id) {
    const r=results[id]; if(!r||r.home===""||r.away==="") return null;
    const gh=parseInt(r.home),ga=parseInt(r.away); if(isNaN(gh)||isNaN(ga)) return null;
    const {home:ht,away:at}=resolveKOTeams(id,placements,results,thirdOverrides,matchOverrides);
    if(gh>ga) return ht; if(ga>gh) return at; return null;
  }
  function loser(id) {
    const r=results[id]; if(!r||r.home===""||r.away==="") return null;
    const gh=parseInt(r.home),ga=parseInt(r.away); if(isNaN(gh)||isNaN(ga)) return null;
    const {home:ht,away:at}=resolveKOTeams(id,placements,results,thirdOverrides,matchOverrides);
    if(gh>ga) return at; if(ga>gh) return ht; return null;
  }
  return {home:teamFromKey(match.homeKey,"home"),away:teamFromKey(match.awayKey,"away")};
}

function labelFromKey(key) {
  if(/^[A-L]0$/.test(key)) return "Etta grupp "+key[0];
  if(/^[A-L]1$/.test(key)) return "Två grupp "+key[0];
  if(/^THIRD_[1-8]$/.test(key)) return "Trea (bestaems 27 jun)";
  if(key.endsWith("L")) return "Förlorare "+key.slice(0,-1);
  return "Vinnare "+key;
}

function calcPoints(tip, result, isKO=false) {
  if(!tip||!result) return 0;
  const th=parseInt(tip.home),ta=parseInt(tip.away);
  const rh=parseInt(result.home),ra=parseInt(result.away);
  if(isNaN(th)||isNaN(ta)||isNaN(rh)||isNaN(ra)) return 0;
  if(th===rh&&ta===ra) return isKO?5:3;
  if(Math.sign(th-ta)===Math.sign(rh-ra)) return isKO?3:1;
  return 0;
}
function calcTotal(tips, results) {
  const groupPts = GROUP_MATCHES.reduce((s,m)=>s+calcPoints(tips[m.id],results[m.id],false),0);
  const koPts = KNOCKOUT_ALL.reduce((s,m)=>s+calcPoints(tips[m.id],results[m.id],true),0);
  return groupPts+koPts;
}

const ADMIN_CODE = "vm2026admin";

// Global sort helper - uses DEFAULT_DEADLINES which is defined globally
function sortByDeadline(matches, deadlines={}) {
  return [...matches].sort((a,b)=>{
    const da=deadlines[a.id]||DEFAULT_DEADLINES[a.id]||a.officialDeadline||"9999";
    const db2=deadlines[b.id]||DEFAULT_DEADLINES[b.id]||b.officialDeadline||"9999";
    return da.localeCompare(db2);
  });
}

function koLabel(m, placements={}, getTeams=()=>({home:null,away:null})) {
  function keyLabel(key) {
    if (/^[A-L]0$/.test(key)) { const t=placements[key]; return t?dn(t):"Etta grupp "+key[0]; }
    if (/^[A-L]1$/.test(key)) { const t=placements[key]; return t?dn(t):"Tvaan grupp "+key[0]; }
    if (/^THIRD_[1-8]$/.test(key)) return "Basta trea #"+key[6];
    if (key.endsWith("L")) return "Forlorare "+key.slice(0,-1);
    const wt=getTeams(key);
    return wt&&wt.home?dn(wt.home):"Vinnare "+key;
  }
  return keyLabel(m.homeKey)+" - "+keyLabel(m.awayKey);
}

const DEFAULT_DEADLINES = {
  "Am1": "2026-06-11T19:00Z",
  "Am2": "2026-06-12T02:00Z",
  "Am3": "2026-06-18T17:00Z",
  "Am4": "2026-06-19T01:00Z",
  "Am5": "2026-06-25T01:00Z",
  "Am6": "2026-06-25T01:00Z",
  "Bm1": "2026-06-12T20:00Z",
  "Bm2": "2026-06-13T23:00Z",
  "Bm3": "2026-06-18T23:00Z",
  "Bm4": "2026-06-18T23:00Z",
  "Bm5": "2026-06-24T23:00Z",
  "Bm6": "2026-06-24T23:00Z",
  "Cm1": "2026-06-13T23:00Z",
  "Cm2": "2026-06-14T02:00Z",
  "Cm3": "2026-06-19T17:00Z",
  "Cm4": "2026-06-19T22:00Z",
  "Cm5": "2026-06-24T23:00Z",
  "Cm6": "2026-06-24T23:00Z",
  "Dm1": "2026-06-13T01:00Z",
  "Dm2": "2026-06-14T04:00Z",
  "Dm3": "2026-06-19T19:00Z",
  "Dm4": "2026-06-20T04:00Z",
  "Dm5": "2026-06-26T02:00Z",
  "Dm6": "2026-06-26T02:00Z",
  "Em1": "2026-06-14T17:00Z",
  "Em2": "2026-06-15T00:00Z",
  "Em3": "2026-06-20T21:00Z",
  "Em4": "2026-06-21T00:00Z",
  "Em5": "2026-06-25T21:00Z",
  "Em6": "2026-06-25T21:00Z",
  "Fm1": "2026-06-14T22:00Z",
  "Fm2": "2026-06-15T04:00Z",
  "Fm3": "2026-06-20T19:00Z",
  "Fm4": "2026-06-21T04:00Z",
  "Fm5": "2026-06-25T23:00Z",
  "Fm6": "2026-06-25T23:00Z",
  "Gm1": "2026-06-15T23:00Z",
  "Gm2": "2026-06-16T01:00Z",
  "Gm3": "2026-06-21T23:00Z",
  "Gm4": "2026-06-22T01:00Z",
  "Gm5": "2026-06-27T03:00Z",
  "Gm6": "2026-06-27T03:00Z",
  "Hm1": "2026-06-15T15:00Z",
  "Hm2": "2026-06-15T23:00Z",
  "Hm3": "2026-06-21T15:00Z",
  "Hm4": "2026-06-21T23:00Z",
  "Hm5": "2026-06-26T22:00Z",
  "Hm6": "2026-06-26T22:00Z",
  "Im1": "2026-06-16T18:00Z",
  "Im2": "2026-06-16T23:00Z",
  "Im3": "2026-06-22T22:00Z",
  "Im4": "2026-06-23T01:00Z",
  "Im5": "2026-06-26T20:00Z",
  "Im6": "2026-06-26T20:00Z",
  "Jm1": "2026-06-17T01:00Z",
  "Jm2": "2026-06-17T04:00Z",
  "Jm3": "2026-06-22T19:00Z",
  "Jm4": "2026-06-23T03:00Z",
  "Jm5": "2026-06-28T02:00Z",
  "Jm6": "2026-06-28T02:00Z",
  "Km1": "2026-06-17T19:00Z",
  "Km2": "2026-06-18T02:00Z",
  "Km3": "2026-06-23T19:00Z",
  "Km4": "2026-06-24T02:00Z",
  "Km5": "2026-06-28T00:30Z",
  "Km6": "2026-06-28T00:30Z",
  "Lm1": "2026-06-17T22:00Z",
  "Lm2": "2026-06-18T00:00Z",
  "Lm3": "2026-06-23T21:00Z",
  "Lm4": "2026-06-24T00:00Z",
  "Lm5": "2026-06-27T22:00Z",
  "Lm6": "2026-06-27T22:00Z",
  // R32: Jun 28 - Jul 3 (officiella tider)
  "R32_1":  "2026-06-29T17:00Z",  // M76: 1F vs 2C, 29 jun 19 CEST
  "R32_2":  "2026-06-29T21:30Z",  // M75: 1C vs 2F, 29 jun 23:30 CEST
  "R32_3":  "2026-06-30T17:00Z",  // M78: 2E vs 2I, 30 jun 19 CEST
  "R32_4":  "2026-07-03T21:00Z",  // M84: 1H vs 2J, 4 jul 01:00 CEST
  "R32_5":  "2026-06-28T21:00Z",  // M73: 2A vs 2B, 29 jun 01:00 CEST
  "R32_6":  "2026-07-04T00:00Z",  // M86: 1J vs 2H, 4 jul 02 CEST
  "R32_7":  "2026-07-04T05:30Z",  // M83: 2K vs 2L, 4 jul 07:30 CEST
  "R32_8":  "2026-07-04T19:00Z",  // M88: 2D vs 2G, 4 jul 21 CEST
  "R32_9":  "2026-06-29T19:30Z",  // M74: 1E vs trea, 30 jun 00:30 CEST
  "R32_10": "2026-06-30T21:00Z",  // M77: 1I vs trea, 1 jul 01 CEST
  "R32_11": "2026-07-01T15:00Z",  // M82: 1G vs trea, 1 jul 17 CEST
  "R32_12": "2026-07-01T19:00Z",  // M81: 1D vs trea, 1 jul 21 CEST
  "R32_13": "2026-07-02T17:00Z",  // M85: 1B vs trea, 2 jul 19 CEST
  "R32_14": "2026-07-02T21:00Z",  // M80: 1L vs trea, 2 jul 23 CEST
  "R32_15": "2026-07-03T03:30Z",  // M87: 1K vs trea, 3 jul 05:30 CEST
  "R32_16": "2026-07-03T19:00Z",  // M79: 1A vs trea, 3 jul 21 CEST
  // R16: Jul 4-7
  "R16_1":  "2026-07-04T17:00Z",
  "R16_2":  "2026-07-05T15:00Z",
  "R16_3":  "2026-07-05T19:00Z",
  "R16_4":  "2026-07-06T14:00Z",
  "R16_5":  "2026-07-06T19:00Z",
  "R16_6":  "2026-07-07T14:00Z",
  "R16_7":  "2026-07-07T17:00Z",
  "R16_8":  "2026-07-07T22:00Z",
  // QF: Jul 9-11
  "QF_1":   "2026-07-09T19:00Z",
  "QF_2":   "2026-07-10T21:00Z",
  "QF_3":   "2026-07-11T20:00Z",
  "QF_4":   "2026-07-12T01:00Z",
  // SF: Jul 14-15
  "SF_1":   "2026-07-14T19:00Z",
  "SF_2":   "2026-07-15T18:00Z",
};
const PODIUM_DEFAULT_DEADLINE = "2026-06-11T19:00:00.000Z";

async function fbSet(id, data) {
  await setDoc(doc(db,"vm2026",id), data, {merge:true});
}


class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = {error: null}; }
  static getDerivedStateFromError(error) { return {error: error.message}; }
  render() {
    if (this.state.error) {
      return <div style={{background:"#1a0000",color:"#ff6060",padding:24,fontFamily:"monospace",fontSize:13,borderRadius:8,margin:20}}>
        <strong>Runtime error (visa för Martin):</strong><br/>{this.state.error}
      </div>;
    }
    return this.props.children;
  }
}

// =============================================================================
// Small reusable display components - must be top-level (not inside App)
function FC({team}){return <span className="fc">{gc(team)}</span>;}
function TL({team,label}){
  if(!team) return <span style={{color:"#50403a"}}>{label||"--"}</span>;
  return <><FC team={team}/><span>{dn(team)}</span></>;
}

export default function App() {
  const [view,           setView]           = useState("start");
  const [participants,   setParticipants]   = useState({});
  const [passwords,      setPasswords]      = useState({});
  const [results,        setResults]        = useState({});
  const [deadlines,      setDeadlines]      = useState({});
  const [thirdOverrides, setThirdOverrides] = useState({});
  const [matchOverrides, setMatchOverrides] = useState({}); // { "R32_1_home": "Brasilien", ... }
  const [visitorStats, setVisitorStats] = useState({totalVisits:0,uniqueCount:0,lastVisit:null});
  const [userGroups, setUserGroups] = useState({}); // {groupName:[member,...]}
  const [approved,       setApproved]       = useState({}); // { name: true/false }
  const [siteInfo,       setSiteInfo]       = useState({}); // { message, prizePot }
  const [podiumTips,     setPodiumTips]     = useState({}); // { name: {winner,second,third} }
  const [podiumDeadline, setPodiumDeadline] = useState(null); // ISO string
  const [podiumResults,  setPodiumResults]  = useState({}); // {winner,second,third}
  const [currentUser,    setCurrentUser]    = useState(null);
  const [nameInput,      setNameInput]      = useState("");
  const [pwInput,        setPwInput]        = useState("");
  const [newPwInput,     setNewPwInput]     = useState("");
  const [loginError,     setLoginError]     = useState("");
  const [tipPhase,       setTipPhase]       = useState("omgang1");
  const [tipGroup,       setTipGroup]       = useState("A");
  const [adminCode,      setAdminCode]      = useState("");
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [saveStatus,     setSaveStatus]     = useState("");
  const [loading,        setLoading]        = useState(true);
  const [adminTab,       setAdminTab]       = useState("results");
  const [dlInput,        setDlInput]        = useState({});
  const [rdlInput,       setRdlInput]       = useState({r1:"",r2:"",r3:""});
  const [now,            setNow]            = useState(Date.now());

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[]);

  // Track visit on mount
  useEffect(()=>{
    async function trackVisit() {
      try {
        // Generate or retrieve visitor ID from localStorage
        let vid = localStorage.getItem("vmtipp_vid");
        if(!vid) {
          vid = Math.random().toString(36).slice(2)+Date.now().toString(36);
          localStorage.setItem("vmtipp_vid", vid);
        }
        const statsRef = doc(db,"vm2026","visitorStats");
        const snap = await getDoc(statsRef);
        const data = snap.exists() ? snap.data() : {};
        const uniqueVisitors = data.uniqueVisitors || {};
        const isNew = !uniqueVisitors[vid];
        // Update: always increment totalVisits, only increment uniqueCount if new visitor
        await setDoc(statsRef, {
          totalVisits: (data.totalVisits||0) + 1,
          uniqueCount: (data.uniqueCount||0) + (isNew?1:0),
          uniqueVisitors: {...uniqueVisitors, [vid]: (uniqueVisitors[vid]||0)+1},
          lastVisit: new Date().toISOString()
        }, {merge:true});
      } catch(e) { /* silent fail */ }
    }
    trackVisit();
  },[]);

  useEffect(()=>{
    const unsubs=[
      onSnapshot(doc(db,"vm2026","participants"),s=>{if(s.exists())setParticipants(s.data());setLoading(false);},()=>setLoading(false)),
      onSnapshot(doc(db,"vm2026","passwords"),   s=>{if(s.exists())setPasswords(s.data());}),
      onSnapshot(doc(db,"vm2026","results"),     s=>{if(s.exists())setResults(s.data());}),
      onSnapshot(doc(db,"vm2026","deadlines"),   s=>{
        if(s.exists()&&Object.keys(s.data()).length>0) setDeadlines(s.data());
        else setDeadlines(DEFAULT_DEADLINES);
      }),
      onSnapshot(doc(db,"vm2026","thirdOverrides"),s=>{if(s.exists())setThirdOverrides(s.data());}),
      onSnapshot(doc(db,"vm2026","matchOverrides"),s=>{if(s.exists())setMatchOverrides(s.data());}),
      onSnapshot(doc(db,"vm2026","podiumTips"),   s=>{if(s.exists())setPodiumTips(s.data());}),
      onSnapshot(doc(db,"vm2026","podiumDeadline"),s=>{
        if(s.exists()&&s.data().dl) setPodiumDeadline(s.data().dl);
        else setPodiumDeadline(PODIUM_DEFAULT_DEADLINE);
      }),
      onSnapshot(doc(db,"vm2026","podiumResults"), s=>{if(s.exists())setPodiumResults(s.data());}),
      onSnapshot(doc(db,"vm2026","approved"),      s=>{if(s.exists())setApproved(s.data());}),
      onSnapshot(doc(db,"vm2026","siteInfo"),      s=>{setSiteInfo(s.exists()?s.data():{});}),
      onSnapshot(doc(db,"vm2026","userGroups"),    s=>{setUserGroups(s.exists()?s.data():{});}),
      onSnapshot(doc(db,"vm2026","visitorStats"),  s=>{if(s.exists())setVisitorStats(s.data());}),
    ];
    return()=>unsubs.forEach(u=>u());
  },[]);

  const placements = resolveGroupPlacements(results);
  function getTeams(mid) { return resolveKOTeams(mid,placements,results,thirdOverrides,matchOverrides); }
  function getDisplay(m) {
    if(m.phase==="Grupp") return {home:dn(m.home),away:dn(m.away)};
    const {home,away}=getTeams(m.id);
    return {home:home?dn(home):labelFromKey(m.homeKey),away:away?dn(away):labelFromKey(m.awayKey)};
  }
  function getEffectiveDl(mid) { return deadlines[mid]||DEFAULT_DEADLINES[mid]||null; }
  function isLocked(mid) { const dl=getEffectiveDl(mid); return dl&&now>=new Date(dl).getTime(); }
  function fmtDl(mid) {
    const dl=getEffectiveDl(mid); if(!dl) return null;
    return new Date(dl).toLocaleString("sv-SE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  // Login/register
  async function handleJoin() {
    const name=nameInput.trim();
    if(!name||!pwInput) { setLoginError("Ange namn och lösenord."); return; }
    if(participants[name]!==undefined) {
      // Befintlig deltagare - logga in
      if(passwords[name]!==pwInput) { setLoginError("Fel lösenord."); return; }
    } else {
      // Kolla att namnet inte redan finns (case-insensitive)
      const nameTaken = Object.keys(participants).some(n=>n.toLowerCase()===name.toLowerCase());
      if(nameTaken) { setLoginError("Namnet ar redan upptaget. Välj ett annat."); return; }
      // Ny deltagare - registrera (ett lösenord racker)
      await fbSet("participants",{...participants,[name]:{}});
      await fbSet("passwords",{...passwords,[name]:pwInput});
    }
    setCurrentUser(name); setView("tips"); setNameInput(""); setPwInput(""); setNewPwInput(""); setLoginError("");
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
    else alert("Fel lösenord");
  }
  async function handleResult(mid,side,val) {
    await fbSet("results",{...results,[mid]:{...(results[mid]||{}),[side]:val}});
  }
  async function setDeadline(mid,iso) { await fbSet("deadlines",{...deadlines,[mid]:iso}); }
  async function rmDeadline(mid) {
    const upd={...deadlines}; delete upd[mid];
    await setDoc(doc(db,"vm2026","deadlines"),upd);
  }
  async function bulkDeadline(group,iso) {
    if(!iso) return;
    const upd={...deadlines};
    GROUP_MATCHES.filter(m=>m.group===group).forEach(m=>{upd[m.id]=iso;});
    await fbSet("deadlines",upd);
  }
  async function bulkRoundDeadline(round,iso) {
    if(!iso) return;
    const upd={...deadlines};
    getMatchesForRound(round).forEach(m=>{upd[m.id]=iso;});
    await fbSet("deadlines",upd);
  }
  async function saveUserGroups(groups) {
    await setDoc(doc(db,"vm2026","userGroups"), groups);
    setUserGroups(groups);
  }
  async function saveMatchOverride(matchId, side, team) {
    const key = matchId+"_"+side;
    const upd = {...matchOverrides};
    if(team) upd[key] = team;
    else delete upd[key];
    await setDoc(doc(db,"vm2026","matchOverrides"), upd);
    setMatchOverrides(upd);
  }
  async function handleThirdOverride(key,team) {
    await fbSet("thirdOverrides",{...thirdOverrides,[key]:team});
  }
  async function deleteParticipant(name) {
    if(!window.confirm("Ta bort "+name+"?")) return;
    const upd={...participants}; delete upd[name];
    await setDoc(doc(db,"vm2026","participants"),upd);
    const pwUpd={...passwords}; delete pwUpd[name];
    await setDoc(doc(db,"vm2026","passwords"),pwUpd);
    if(currentUser===name){setCurrentUser(null); setView("start");}
  }
  async function resetPassword(name, newPw) {
    if(!newPw||newPw.length<2) return false;
    await fbSet("passwords",{...passwords,[name]:newPw});
    return true;
  }
  async function saveSiteInfo(updates) {
    const upd={...siteInfo,...updates};
    await setDoc(doc(db,"vm2026","siteInfo"),upd);
    setSiteInfo(upd);
  }
  async function toggleApproved(name) {
    const upd={...approved,[name]:!approved[name]};
    await fbSet("approved",upd);
  }
  function loginAs(name, pw) {
    if(passwords[name]===pw) {
      setCurrentUser(name); setView("tips"); return true;
    }
    return false;
  }
  const podiumLocked = podiumDeadline && now >= new Date(podiumDeadline).getTime();
  async function savePodiumTip(field, team) {
    if(podiumLocked) return;
    const upd={...podiumTips,[currentUser]:{...(podiumTips[currentUser]||{}),[field]:team}};
    await fbSet("podiumTips",upd);
  }
  async function savePodiumDeadline(iso) {
    await setDoc(doc(db,"vm2026","podiumDeadline"),{dl:iso});
    setPodiumDeadline(iso);
  }
  async function savePodiumResults(field, team) {
    const upd={...podiumResults,[field]:team};
    await setDoc(doc(db,"vm2026","podiumResults"),upd);
    setPodiumResults(upd);
  }
  function calcPodiumPoints(name) {
    const tip=podiumTips[name]||{};
    let pts=0;
    if(podiumResults.winner&&tip.winner===podiumResults.winner) pts+=20;
    if(podiumResults.second&&tip.second===podiumResults.second) pts+=15;
    if(podiumResults.third&&tip.third===podiumResults.third)    pts+=10;
    return pts;
  }

  const leaderboard=Object.entries(participants)
    .filter(([name])=>approved[name])
    .map(([name,tips])=>({name,
      points:calcTotal(tips,results)+calcPodiumPoints(name),
      matchPoints:calcTotal(tips,results),
      podiumPoints:calcPodiumPoints(name),
      tipped:[...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m=>{const t=tips[m.id];return t&&t.home!=""&&t.away!="";}).length}))
    .sort((a,b)=>b.points-a.points);

  const userTips=participants[currentUser]||{};
  const totalMatches=GROUP_MATCHES.length+KNOCKOUT_ALL.length;
  function countTipped(){
    return[...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m=>{const t=userTips[m.id];return t&&t.home!=""&&t.away!="";}).length;
  }
  function sortByDeadlineLocal(matches) {
    return sortByDeadline(matches, deadlines);
  }
  const filteredMatches=sortByDeadlineLocal(
    tipPhase==="Grupp"?GROUP_MATCHES.filter(m=>m.group===tipGroup)
    :tipPhase==="omgang1"?getMatchesForRound(1)
    :tipPhase==="omgang2"?getMatchesForRound(2)
    :tipPhase==="omgang3"?getMatchesForRound(3)
    :KNOCKOUT_ALL.filter(m=>m.phase===tipPhase)
  );

  const bestThirds=getBestThirds(results);

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#0a1628",color:"#f5c842",fontFamily:"Georgia,serif",fontSize:20}}>
      Laddar P14 HIKs VM-tipp 2026...
    </div>
  );

  const css=`
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
    .btn-ghost{background:transparent;border:1px solid rgba(245,200,66,0.35);color:#f5c842;padding:8px 18px;border-radius:8px;cursor:pointer;font-family:'Source Sans 3',sans-serif;font-weight:700;font-size:14px;}
    .btn-ghost:hover{background:rgba(245,200,66,0.08);}
    .btn-danger{background:#b83232;color:#fff} .btn-danger:hover{background:#d44}
    .tab{background:transparent;border:none;color:#c8b89a;padding:8px 14px;cursor:pointer;
      font-size:13px;border-bottom:2px solid transparent;transition:all .15s;
      font-family:'Source Sans 3',sans-serif;font-weight:600}
    .tab.active{color:#f5c842;border-bottom-color:#f5c842} .tab:hover:not(.active){color:#f0d890}
    .mc{background:rgba(255,255,255,0.04);border:1px solid rgba(255,200,80,0.1);
      border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:8px}
    .mc.tipped{border-color:rgba(80,200,120,0.3);background:rgba(80,200,120,0.04)}
    .mc.locked-card{border-color:rgba(180,70,70,0.25);background:rgba(140,50,50,0.05)}
    .nav-link{background:none;border:none;color:#a09070;cursor:pointer;font-size:13px;
      font-family:'Source Sans 3',sans-serif;padding:6px 11px;border-radius:6px;font-weight:600;transition:all .15s}
    .nav-link:hover{color:#f5c842;background:rgba(245,200,66,0.06)} .nav-link.active{color:#f5c842}
    .gbtn{background:rgba(255,255,255,0.06);color:#c8b89a;border:none;border-radius:5px;
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
    .err{color:#e07070;font-size:12px;font-family:'Source Sans 3',sans-serif;margin-top:8px;}
  `;

  // FC and TL are top-level components (below)

  return(
    <div style={{minHeight:"100vh",background:"#0a1628",fontFamily:"Georgia,serif",color:"#f0e6d3"}}>
      <style>{css}</style>
      <header style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(245,200,66,0.15)",padding:"0 16px"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontSize:22}}>&#9917;</span>
            <span className="pf" style={{fontSize:16,color:"#f5c842",fontWeight:900}}>P14 HIKs VM-tipp 2026</span>
          </div>
          <nav style={{display:"flex",gap:1,flexWrap:"wrap"}}>
            <button className={"nav-link"+(view==="start"?" active":"")} onClick={()=>setView("start")}>Hem</button>
            {currentUser&&<button className={"nav-link"+(view==="tips"?" active":"")} onClick={()=>setView("tips")}>Mina tips</button>}
            <button className={"nav-link"+(view==="leaderboard"?" active":"")} onClick={()=>setView("leaderboard")}>Topplista</button>
            <button className={"nav-link"+(view==="participants"?" active":"")} onClick={()=>setView("participants")}>Deltagare</button>
            <button className={"nav-link"+(view==="results"?" active":"")} onClick={()=>setView("results")}>Resultat</button>
            <button className={"nav-link"+(view==="bracket"?" active":"")} onClick={()=>setView("bracket")}>Slutspel</button>
            {!isAdmin&&<button className={"nav-link"+(view==="adminlogin"?" active":"")} onClick={()=>setView("adminlogin")}>Admin</button>}
            {isAdmin &&<button className={"nav-link"+(view==="admin"?" active":"")} onClick={()=>setView("admin")}>Admin</button>}
          </nav>
        </div>
      </header>

      <main style={{maxWidth:1000,margin:"0 auto",padding:"28px 16px 80px"}}>

        {/* START / LOGIN */}
        {view==="start"&&(
          <div style={{textAlign:"center",paddingTop:28}}>
            <img src="/HIK.png" alt="Hovslatts IK" style={{
              width:240,height:130,objectFit:"contain",marginBottom:10,
              filter:"drop-shadow(0 0 16px rgba(245,200,66,0.2))"
            }}/>
            <h1 className="pf" style={{fontSize:38,color:"#f5c842",fontWeight:900,lineHeight:1.1,marginBottom:6}}>P14 HIKs VM-tipp 2026</h1>
            <p className="ss" style={{fontSize:17,color:"#a09070",marginBottom:5}}>USA · Mexiko · Kanada</p>
            <p className="ss" style={{fontSize:13,color:"#60504a",marginBottom:40}}>11 juni - 19 juli 2026</p>

            {/* VINSTPOTT */}
            {siteInfo.prizePot&&(
              <div style={{background:"rgba(80,200,120,0.08)",border:"1px solid rgba(80,200,120,0.3)",borderRadius:12,padding:"16px 24px",maxWidth:500,margin:"0 auto 16px",textAlign:"center"}}>
                <p className="ss" style={{fontSize:11,color:"#50c878",fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>Vinstpott</p>
                <p className="pf" style={{fontSize:32,color:"#50c878",fontWeight:900}}>{siteInfo.prizePot}</p>
                <p className="ss" style={{fontSize:11,color:"#60504a",marginTop:6}}>60% till ettan &bull; 30% till tvåan &bull; 10% till trean</p>
              </div>
            )}

            {/* MEDDELANDE FRAN ADMIN */}
            {siteInfo.message&&(
              <div style={{background:"rgba(245,200,66,0.08)",border:"1px solid rgba(245,200,66,0.25)",borderRadius:12,padding:"14px 20px",maxWidth:500,margin:"0 auto 16px",textAlign:"left"}}>
                <p className="ss" style={{fontSize:11,color:"#f5c842",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>Meddelande fr&aring;n Admin</p>
                <p className="ss" style={{fontSize:14,color:"#f0e6d3",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{siteInfo.message}</p>
              </div>
            )}

            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.12)",borderRadius:14,padding:"20px 28px",maxWidth:560,margin:"0 auto 20px",textAlign:"left"}}>
              <p className="pf" style={{fontSize:15,color:"#f5c842",fontWeight:700,marginBottom:14,textAlign:"center"}}>Hur fungerar tippningen?</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>&#128100;</span>
                  <p className="ss" style={{fontSize:13,color:"#c8b89a",lineHeight:1.6}}>
                    <strong style={{color:"#f0e6d3"}}>Registrera dig och betala</strong> - Skapa din användare och swisha 60 kr till 0706-426251 (gratis för HIK P14). Hälften går till vinstpotten och hälften till P14s lagkassa. Du syns på topplistan när admin godkänt din betalning.
                  </p>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>&#9917;</span>
                  <p className="ss" style={{fontSize:13,color:"#c8b89a",lineHeight:1.6}}>
                    <strong style={{color:"#f0e6d3"}}>Tippa ett resultat för varje match</strong> - gruppspel och slutspel.
                  </p>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>&#128241;</span>
                  <p className="ss" style={{fontSize:13,color:"#c8b89a",lineHeight:1.6}}>
                    <strong style={{color:"#f0e6d3"}}>Ga med i WhatsApp-gruppen</strong> (frivilligt) &ndash;{" "}
                    <a href="https://chat.whatsapp.com/G4XIM2xifAiAvRyTP8hT9S?mode=gi_t"
                      target="_blank" rel="noopener noreferrer"
                      style={{color:"#f5c842",textDecoration:"underline"}}>VM Tippning HIK p14</a>
                  </p>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>&#128274;</span>
                  <p className="ss" style={{fontSize:13,color:"#c8b89a",lineHeight:1.6}}>
                    <strong style={{color:"#f0e6d3"}}>Deadlines</strong><br/>
                    &nbsp;&nbsp;&#x1F4C5; Gruppspel omgång 1 &mdash; 11 juni kl 21:00<br/>
                    &nbsp;&nbsp;&#x1F4C5; Gruppspel omgång 2 &mdash; 18 juni kl 19:00<br/>
                    &nbsp;&nbsp;&#x1F4C5; Gruppspel omgång 3 &mdash; 24 juni kl 21:00<br/>
                    &nbsp;&nbsp;&#x1F3C6; Slutspel &mdash; låses individuellt vid matchstart
                  </p>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>&#127941;</span>
                  <p className="ss" style={{fontSize:13,color:"#c8b89a",lineHeight:1.6}}>
                    <strong style={{color:"#f0e6d3"}}>Poäng per match</strong> - Gruppspel: 3p exakt, 1p rätt 1X2 &bull; Slutspel: 5p exakt, 3p rätt 1X2 &bull; 0p om fel.
                  </p>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>&#127942;</span>
                  <p className="ss" style={{fontSize:13,color:"#c8b89a",lineHeight:1.6}}>
                    <strong style={{color:"#f0e6d3"}}>Tippa prispall</strong> - Tippa vilka som vinner VM-guldet (20p), kommer tvåa (15p) och trea (10p). Deadline 11 juni kl 21:00.
                  </p>
                </div>
              </div>
            </div>

            {/* ANTAL DELTAGARE */}
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
              <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.12)",borderRadius:12,padding:"14px 28px",textAlign:"center"}}>
                <div className="pf" style={{fontSize:20,color:"#f5c842",fontWeight:700,marginBottom:2}}>{Object.keys(participants).length}</div>
                <div className="ss" style={{fontSize:12,color:"#60504a"}}>registrerade tippare</div>
              </div>
            </div>

            {currentUser?(
              <div style={{background:"rgba(80,200,120,0.08)",border:"1px solid rgba(80,200,120,0.25)",borderRadius:14,padding:"20px 24px",maxWidth:400,margin:"0 auto 20px"}}>
                <p className="pf" style={{fontSize:18,color:"#50c878",fontWeight:700,marginBottom:12}}>Inloggad som {currentUser}</p>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button className="btn" onClick={()=>setView("tips")}>Mina tips</button>
                  <button className="btn-ghost" onClick={()=>setCurrentUser(null)}>Logga ut</button>
                </div>
              </div>
            ):(
              <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:14,padding:"26px 22px",maxWidth:400,margin:"0 auto 20px"}}>
                <h2 className="pf" style={{fontSize:19,color:"#f5c842",marginBottom:6,fontWeight:700}}>
                  {nameInput&&participants[nameInput]?"Logga in":"Registrera dig"}
                </h2>
                <p className="ss" style={{fontSize:11,color:"#60504a",marginBottom:16}}>
                  {nameInput&&participants[nameInput]
                    ?"Ange ditt lösenord for att logga in och redigera dina tips."
                    :"Ange ditt namn och välj ett lösenord."}
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <input type="text" placeholder="Ditt namn" value={nameInput}
                    onChange={e=>{setNameInput(e.target.value);setLoginError("");}}
                    style={{width:"100%"}}/>
                  {nameInput&&!participants[nameInput]&&Object.keys(participants).map(n=>n.toLowerCase()).includes(nameInput.trim().toLowerCase())&&nameInput.trim()!==""&&(
                    <p className="err">Namnet "{nameInput.trim()}" ar redan upptaget. Välj ett annat namn.</p>
                  )}
                  <input type="password" placeholder="Lösenord" value={pwInput}
                    onChange={e=>{setPwInput(e.target.value);setLoginError("");}}
                    style={{width:"100%"}}/>
                  {nameInput&&!participants[nameInput.trim()]&&(
                    <input type="password" placeholder="Bekräfta lösenord" value={newPwInput}
                      onChange={e=>{setNewPwInput(e.target.value);setLoginError("");}}
                      onKeyDown={e=>e.key==="Enter"&&handleJoin()}
                      style={{width:"100%"}}/>
                  )}
                  {nameInput&&participants[nameInput.trim()]&&(
                    <input type="password" placeholder="" value={newPwInput} onChange={()=>{}} style={{display:"none"}}/>
                  )}
                  {loginError&&<p className="err">{loginError}</p>}
                  <button className="btn" onClick={handleJoin} style={{width:"100%"}}>
                    {nameInput&&participants[nameInput]?"Logga in":"Registrera och tippa!"}
                  </button>
                  {!nameInput||!participants[nameInput]?(
                    <p className="ss" style={{fontSize:11,color:"#60504a",textAlign:"center"}}>
                      Redan registrerad? Gå till <button onClick={()=>setView("participants")} style={{background:"none",border:"none",color:"#f5c842",cursor:"pointer",fontSize:11,fontFamily:"'Source Sans 3',sans-serif",textDecoration:"underline",padding:0}}>Deltagare</button> och klicka Redigera.
                    </p>
                  ):null}
                </div>
              </div>
            )}


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
                <button className="btn-ghost" style={{padding:"6px 14px",fontSize:12,borderRadius:6}} onClick={()=>setView("changepw")}>Byt lösenord</button>
                <button className="btn-ghost" style={{padding:"6px 14px",fontSize:12,borderRadius:6}} onClick={()=>{setCurrentUser(null);setView("start");}}>Logga ut</button>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:4,height:5,marginBottom:22,overflow:"hidden"}}>
              <div style={{background:"#f5c842",height:"100%",width:(countTipped()/totalMatches*100)+"%",transition:"width .3s",borderRadius:4}}/>
            </div>
            {/* GRUPPER */}
            {Object.keys(userGroups).length>0&&(
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:10,padding:"12px 16px",marginBottom:18}}>
                <p className="pf" style={{fontSize:13,color:"#f5c842",fontWeight:700,marginBottom:10}}>Mina grupper</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.keys(userGroups).sort().map(g=>{
                    const isMember=(userGroups[g]||[]).includes(currentUser);
                    return(
                      <button key={g} onClick={()=>{
                        const members=userGroups[g]||[];
                        const upd=isMember?members.filter(m=>m!==currentUser):[...members,currentUser];
                        saveUserGroups({...userGroups,[g]:upd});
                      }}
                        style={{background:isMember?"rgba(245,200,66,0.15)":"rgba(255,255,255,0.04)",
                          border:"1px solid "+(isMember?"rgba(245,200,66,0.35)":"rgba(255,255,255,0.08)"),
                          borderRadius:16,padding:"5px 14px",cursor:"pointer",
                          color:isMember?"#f5c842":"#a09070",
                          fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:isMember?700:400}}>
                        {isMember?"OK ":""}{g}
                      </button>
                    );
                  })}
                </div>
                <p className="ss" style={{fontSize:10,color:"#50403a",marginTop:8}}>Klicka for att ga med i eller lamna en grupp.</p>
              </div>
            )}

            {/* PRISPALL-TIPS */}
            <PodiumTipBox
              currentUser={currentUser}
              podiumTip={podiumTips[currentUser]||{}}
              podiumDeadline={podiumDeadline}
              podiumLocked={podiumLocked}
              podiumResults={podiumResults}
              savePodiumTip={savePodiumTip}
              fmtDl={()=>podiumDeadline?new Date(podiumDeadline).toLocaleString("sv-SE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):null}
            />

            <div className="scroll-x" style={{marginBottom:12}}>
              <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",minWidth:"max-content"}}>
                <button className={"tab"+(tipPhase==="omgang1"?" active":"")} onClick={()=>setTipPhase("omgang1")}>Omgång 1</button>
                <button className={"tab"+(tipPhase==="omgang2"?" active":"")} onClick={()=>setTipPhase("omgang2")}>Omgång 2</button>
                <button className={"tab"+(tipPhase==="omgang3"?" active":"")} onClick={()=>setTipPhase("omgang3")}>Omgång 3</button>
                <button className={"tab"+(tipPhase==="Grupp"?" active":"")} onClick={()=>setTipPhase("Grupp")}>Per grupp</button>
                {PHASES.filter(p=>p!=="Grupp").map(p=><button key={p} className={"tab"+(tipPhase===p?" active":"")} onClick={()=>setTipPhase(p)}>{p}</button>)}
              </div>
            </div>
            {tipPhase==="Grupp"&&(
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
                {Object.keys(GROUPS).map(g=>(
                  <button key={g} className={"gbtn"+(tipGroup===g?" active":"")} onClick={()=>setTipGroup(g)}>Grupp {g}</button>
                ))}
              </div>
            )}
            {(tipPhase==="omgang1"||tipPhase==="omgang2"||tipPhase==="omgang3")&&(
              <div style={{background:"rgba(245,200,66,0.05)",border:"1px solid rgba(245,200,66,0.12)",borderRadius:8,padding:"8px 14px",marginBottom:14}}>
                <span className="ss" style={{fontSize:11,color:"#a09070"}}>
                  {tipPhase==="omgang1"?"Omgång 1: 11-17 juni - varje grupps första 2 matcher":
                   tipPhase==="omgang2"?"Omgång 2: 18-24 juni - varje grupps matcher 3 och 4":
                   "Omgång 3: 25-27 juni - avgörande omgång, båda matcherna i varje grupp spelas samtidigt"}
                </span>
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
                      {!locked&&dl&&<span className="open-badge">Stänger {dl}</span>}
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
          <LeaderboardView leaderboard={leaderboard} userGroups={userGroups}/>
        )}

        {/* DELTAGARE */}
        {view==="participants"&&(
          <ParticipantsView participants={participants} results={results} deadlines={deadlines} now={now} loginAs={loginAs} onLoggedIn={()=>setView("tips")}/>
        )}

        {/* RESULTAT */}
        {view==="results"&&(
          <ResultsView results={results} getTeams={getTeams} getDisplay={getDisplay} placements={placements} bestThirds={bestThirds} deadlines={deadlines}/>
        )}

        {/* SLUTSPEL */}
        {view==="bracket"&&(
          <BracketView placements={placements} results={results} getTeams={getTeams} bestThirds={bestThirds}/>
        )}

        {/* BYT LOSENORD */}
        {view==="changepw"&&currentUser&&(
          <ChangePwView
            currentUser={currentUser}
            passwords={passwords}
            onSaved={()=>setView("tips")}
            onCancel={()=>setView("tips")}
          />
        )}

        {/* ADMIN LOGIN */}
        {view==="adminlogin"&&(
          <div style={{maxWidth:370,margin:"60px auto",textAlign:"center"}}>
            <h2 className="pf" style={{fontSize:22,color:"#f5c842",marginBottom:20,fontWeight:700}}>Admin</h2>
            <div style={{display:"flex",gap:8}}>
              <input type="password" placeholder="Lösenord" value={adminCode}
                onChange={e=>setAdminCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()} style={{flex:1}}/>
              <button className="btn" onClick={handleAdminLogin}>Logga in</button>
            </div>
          </div>
        )}

        {/* ADMIN */}
        {view==="admin"&&isAdmin&&(
          <ErrorBoundary>
          <AdminView
            results={results} deadlines={deadlines} thirdOverrides={thirdOverrides}
            tipPhase={tipPhase} setTipPhase={setTipPhase} tipGroup={tipGroup} setTipGroup={setTipGroup}
            adminTab={adminTab} setAdminTab={setAdminTab} dlInput={dlInput} setDlInput={setDlInput}
            rdlInput={rdlInput} setRdlInput={setRdlInput}
            filteredMatches={filteredMatches} getDisplay={getDisplay} getTeams={getTeams}
            handleResult={handleResult} setDeadline={setDeadline} rmDeadline={rmDeadline}
            bulkDeadline={bulkDeadline} bulkRoundDeadline={bulkRoundDeadline} isLocked={isLocked} fmtDl={fmtDl}
            placements={placements} bestThirds={bestThirds} handleThirdOverride={handleThirdOverride}
            participants={participants} deleteParticipant={deleteParticipant} resetPassword={resetPassword}
            approved={approved} toggleApproved={toggleApproved}
            podiumDeadline={podiumDeadline} podiumResults={podiumResults} podiumLocked={podiumLocked}
            savePodiumDeadline={savePodiumDeadline} savePodiumResults={savePodiumResults}
            podiumTips={podiumTips}
            siteInfo={siteInfo} saveSiteInfo={saveSiteInfo}
            matchOverrides={matchOverrides} saveMatchOverride={saveMatchOverride}
            visitorStats={visitorStats}
            userGroups={userGroups} saveUserGroups={saveUserGroups}
          />
          </ErrorBoundary>
        )}

        {view==="tips"&&!currentUser&&(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <p className="ss" style={{color:"#a09070",marginBottom:16}}>Logga in pa startsidan for att se och redigera dina tips.</p>
            <button className="btn" onClick={()=>setView("start")}>Till startsidan</button>
          </div>
        )}
      </main>
    </div>
  );
}

// BYT LOSENORD-VY
function ChangePwView({currentUser, passwords, onSaved, onCancel}) {
  const [oldPw,  setOldPw]  = useState("");
  const [newPw,  setNewPw]  = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [err,    setErr]    = useState("");
  const [ok,     setOk]     = useState("");

  async function handleSave() {
    setErr(""); setOk("");
    if(passwords[currentUser] !== oldPw) { setErr("Nuvarande lösenord stammer inte."); return; }
    if(newPw.length < 2) { setErr("Nytt lösenord måste vara minst 2 tecken."); return; }
    if(newPw !== newPw2) { setErr("De nya lösenorden matchar inte."); return; }
    await fbSet("passwords", {...passwords, [currentUser]: newPw});
    setOk("Lösenord uppdat! Omdirigerar..."); 
    setTimeout(onSaved, 1500);
  }

  return(
    <div style={{maxWidth:420,margin:"60px auto"}}>
      <h2 className="pf" style={{fontSize:26,color:"#f5c842",fontWeight:700,marginBottom:6}}>Byt lösenord</h2>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:24}}>Inloggad som <strong style={{color:"#f0e6d3"}}>{currentUser}</strong></p>
      <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:12,padding:"24px 20px",display:"flex",flexDirection:"column",gap:12}}>
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:6}}>Nuvarande lösenord</p>
          <input type="password" placeholder="Nuvarande lösenord" value={oldPw}
            onChange={e=>{setOldPw(e.target.value);setErr("");}} style={{width:"100%"}}/>
        </div>
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:6}}>Nytt lösenord</p>
          <input type="password" placeholder="Nytt lösenord" value={newPw}
            onChange={e=>{setNewPw(e.target.value);setErr("");}} style={{width:"100%"}}/>
        </div>
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:6}}>Bekräfta nytt lösenord</p>
          <input type="password" placeholder="Upprepa nytt lösenord" value={newPw2}
            onChange={e=>{setNewPw2(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleSave()} style={{width:"100%"}}/>
        </div>
        {err&&<p className="err">{err}</p>}
        {ok&&<p className="ss" style={{color:"#50c878",fontSize:13}}>{ok}</p>}
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <button className="btn" onClick={handleSave} style={{flex:1}}>Spara nytt lösenord</button>
          <button className="btn-ghost" onClick={onCancel}>Avbryt</button>
        </div>
      </div>
    </div>
  );
}

// PRISPALL-TIPS KOMPONENT
function PodiumTipBox({currentUser, podiumTip, podiumDeadline, podiumLocked, podiumResults, savePodiumTip, fmtDl}) {
  const allTeams = Object.values(GROUPS).flat().sort((a,b)=>a.localeCompare(b));
  const dl = fmtDl();

  const slots = [
    {key:"winner", label:"Segrare (VM-guld)",   pts:20, icon:"1"},
    {key:"second", label:"Två (finalförlorare)", pts:15, icon:"2"},
    {key:"third",  label:"Trea (bronsmatch)",     pts:10, icon:"3"},
  ];

  function checkPts(key) {
    if(!podiumResults[key]) return null;
    return podiumTip[key]===podiumResults[key] ? slots.find(s=>s.key===key).pts : 0;
  }

  return(
    <div style={{background:"rgba(245,200,66,0.06)",border:"1px solid rgba(245,200,66,0.2)",
      borderRadius:12,padding:"18px 16px",marginBottom:22}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <h3 className="pf" style={{fontSize:17,color:"#f5c842",fontWeight:700}}>Tippa prispall</h3>
          <p className="ss" style={{fontSize:11,color:"#a09070",marginTop:2}}>Tippa vem som vinner VM, kommer två och trea. 20/15/10 poäng.</p>
        </div>
        {podiumLocked
          ? <span className="lock-badge">Last</span>
          : dl && <span className="open-badge">Stänger {dl}</span>
        }
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {slots.map(s=>{
          const pts=checkPts(s.key);
          return(
            <div key={s.key} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,minWidth:220}}>
                <span style={{background:"#f5c842",color:"#0a1628",borderRadius:"50%",width:22,height:22,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,fontWeight:900,fontFamily:"'Source Sans 3',sans-serif",flexShrink:0}}>{s.icon}</span>
                <span className="ss" style={{fontSize:13,fontWeight:600,color:"#f0e6d3"}}>{s.label}</span>
                <span className="ss" style={{fontSize:11,color:"#f5c842",fontWeight:700}}>({s.pts}p)</span>
              </div>
              {podiumLocked?(
                <span className="ss" style={{fontSize:13,fontWeight:700,
                  color:pts===null?"#a09070":pts>0?"#50c878":"#e07070"}}>
                  {podiumTip[s.key]||"Ej tippat"}
                  {pts!==null&&<span style={{marginLeft:6,fontSize:11}}>({pts>0?"+"+pts:0}p)</span>}
                </span>
              ):(
                <select value={podiumTip[s.key]||""} onChange={e=>savePodiumTip(s.key,e.target.value)}
                  style={{flex:1,minWidth:160}}>
                  <option value="">-- Välj lag --</option>
                  {allTeams.map(t=><option key={t} value={t}>{dn(t)}</option>)}
                </select>
              )}
              {podiumResults[s.key]&&(
                <span className="ss" style={{fontSize:11,color:"#60504a"}}>Facit: {dn(podiumResults[s.key])}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// DELTAGARE-VY
function ParticipantsView({participants, results, deadlines, now, loginAs, onLoggedIn}) {
  const [selName, setSelName] = useState(null);
  const [selPhase, setSelPhase] = useState("omgang1");
  const [selGroup, setSelGroup] = useState("A");
  const [loginModal, setLoginModal] = useState(null); // name to login as
  const [modalPw, setModalPw] = useState("");
  const [modalErr, setModalErr] = useState("");

  function isVisible(matchId) {
    const dl=deadlines[matchId];
    if(!dl) return false;
    return now>=new Date(dl).getTime();
  }

  function getVisibleMatches() {
    if(selPhase==="omgang1") return getMatchesForRound(1);
    if(selPhase==="omgang2") return getMatchesForRound(2);
    if(selPhase==="omgang3") return getMatchesForRound(3);
    if(selPhase==="Grupp") return GROUP_MATCHES.filter(m=>m.group===selGroup);
    return KNOCKOUT_ALL.filter(m=>m.phase===selPhase);
  }

  function handleModalLogin() {
    const ok = loginAs(loginModal, modalPw);
    if(ok) { setLoginModal(null); setModalPw(""); setModalErr(""); onLoggedIn(); }
    else { setModalErr("Fel lösenord. Forsok igen."); }
  }

  const matches=getVisibleMatches();
  const names=Object.keys(participants).sort();
  const tips=selName?(participants[selName]||{}):null;

  return(
    <div>
      {/* Login modal */}
      {loginModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#0f1e35",border:"1px solid rgba(245,200,66,0.3)",borderRadius:14,
            padding:"28px 24px",maxWidth:360,width:"90%"}}>
            <h3 className="pf" style={{fontSize:20,color:"#f5c842",fontWeight:700,marginBottom:6}}>Redigera {loginModal}s tips</h3>
            <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:16}}>Ange lösenord for {loginModal} for att redigera deras tips.</p>
            <input type="password" placeholder="Lösenord" value={modalPw}
              onChange={e=>{setModalPw(e.target.value);setModalErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handleModalLogin()}
              style={{width:"100%",marginBottom:10}}/>
            {modalErr&&<p className="err" style={{marginBottom:10}}>{modalErr}</p>}
            <div style={{display:"flex",gap:10}}>
              <button className="btn" onClick={handleModalLogin} style={{flex:1}}>Logga in och redigera</button>
              <button className="btn-ghost" onClick={()=>{setLoginModal(null);setModalPw("");setModalErr("");}}>Avbryt</button>
            </div>
          </div>
        </div>
      )}

      <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:6}}>Deltagare</h2>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:22}}>
        Klicka pa ett namn for att se tips. Klicka "Redigera" for att logga in och ändra tips.
      </p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:22}}>
        {names.map(name=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setSelName(selName===name?null:name)}
              style={{background:selName===name?"#f5c842":"rgba(255,255,255,0.06)",
                color:selName===name?"#0a1628":"#a09070",border:"none",borderRadius:"8px 0 0 8px",
                padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13,
                fontFamily:"'Source Sans 3',sans-serif",transition:"all .15s"}}>
              {name}
            </button>
            <button onClick={()=>{setLoginModal(name);setModalPw("");setModalErr("");}}
              style={{background:"rgba(245,200,66,0.12)",color:"#f5c842",border:"1px solid rgba(245,200,66,0.2)",
                borderRadius:"0 8px 8px 0",padding:"8px 10px",cursor:"pointer",fontSize:11,fontWeight:700,
                fontFamily:"'Source Sans 3',sans-serif",whiteSpace:"nowrap"}}>
              Redigera
            </button>
          </div>
        ))}
        {names.length===0&&<p className="ss" style={{color:"#60504a"}}>Inga deltagare än.</p>}
      </div>
      {selName&&(
        <div>
          <h3 className="pf" style={{fontSize:20,color:"#f5c842",fontWeight:700,marginBottom:14}}>{selName}s tips</h3>
          <div className="scroll-x" style={{marginBottom:12}}>
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",minWidth:"max-content"}}>
              <button className={"tab"+(selPhase==="omgang1"?" active":"")} onClick={()=>setSelPhase("omgang1")}>Omgång 1</button>
              <button className={"tab"+(selPhase==="omgang2"?" active":"")} onClick={()=>setSelPhase("omgang2")}>Omgång 2</button>
              <button className={"tab"+(selPhase==="omgang3"?" active":"")} onClick={()=>setSelPhase("omgang3")}>Omgång 3</button>
              <button className={"tab"+(selPhase==="Grupp"?" active":"")} onClick={()=>setSelPhase("Grupp")}>Per grupp</button>
              {PHASES.filter(p=>p!=="Grupp").map(p=>(
                <button key={p} className={"tab"+(selPhase===p?" active":"")} onClick={()=>setSelPhase(p)}>{p}</button>
              ))}
            </div>
          </div>
          {selPhase==="Grupp"&&(
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
              {Object.keys(GROUPS).map(g=>(
                <button key={g} className={"gbtn"+(selGroup===g?" active":"")} onClick={()=>setSelGroup(g)}>Grupp {g}</button>
              ))}
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {matches.map(m=>{
              const visible=isVisible(m.id);
              const tip=tips[m.id];
              const hasTip=tip&&tip.home!=""&&tip.away!="";
              const hasResult=results[m.id]&&results[m.id].home!=""&&results[m.id].away!="";
              const pts=visible&&hasTip?calcPoints(tip,results[m.id]):null;
              const hTeam=m.phase==="Grupp"?m.home:null;
              const aTeam=m.phase==="Grupp"?m.away:null;
              return(
                <div key={m.id} style={{background:"rgba(255,255,255,0.04)",
                  border:"1px solid "+(visible?"rgba(80,200,120,0.2)":"rgba(255,255,255,0.06)"),
                  borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,
                  opacity:visible?1:0.5}}>
                  {hTeam&&<span className="fc">{gc(hTeam)}</span>}
                  <span className="tn" style={{textAlign:"right",color:visible?"#f0e6d3":"#604848"}}>{hTeam?dn(hTeam):"Match "+m.id}</span>
                  <div style={{minWidth:90,textAlign:"center"}}>
                    {visible&&hasTip?(
                      <span className="pf" style={{fontSize:15,fontWeight:700,
                        color:pts===3?"#50c878":pts===1?"#f5c842":pts===0&&hasResult?"#e07070":"#f0e6d3"}}>
                        {tip.home} - {tip.away}
                        {pts!==null&&<span className="ss" style={{fontSize:11,marginLeft:6,opacity:.8}}>({pts}p)</span>}
                      </span>
                    ):visible&&!hasTip?(
                      <span className="ss" style={{fontSize:11,color:"#a05050"}}>Ej tippat</span>
                    ):(
                      <span className="ss" style={{fontSize:11,color:"#50403a"}}>Dölda</span>
                    )}
                  </div>
                  {aTeam&&<span className="tn" style={{color:visible?"#f0e6d3":"#604848"}}>{dn(aTeam)}</span>}
                  {aTeam&&<span className="fc">{gc(aTeam)}</span>}
                  {hasResult&&visible&&(
                    <span className="ss" style={{fontSize:10,color:"#60504a",whiteSpace:"nowrap"}}>
                      Facit: {results[m.id].home}-{results[m.id].away}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!selName&&names.length>0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#60504a"}}>
          <p className="ss" style={{fontSize:14}}>Välj en deltagare ovan for att se deras tips.</p>
        </div>
      )}
    </div>
  );
}

// TOPPLISTA
function LeaderboardView({leaderboard, userGroups}) {
  const [activeGroup, setActiveGroup] = useState("Alla");

  const groupNames = ["Alla", ...Object.keys(userGroups).sort()];

  const filtered = activeGroup==="Alla"
    ? leaderboard
    : leaderboard.filter(e=>(userGroups[activeGroup]||[]).includes(e.name));

  // Re-rank within filtered group
  const ranked = filtered.map((e,i)=>({...e, rank:i+1}));

  return(
    <div>
      <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:5}}>Topplista</h2>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:16}}>Uppdateras nar resultat registreras</p>

      {/* Group filter tabs */}
      {groupNames.length>1&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
          {groupNames.map(g=>(
            <button key={g} onClick={()=>setActiveGroup(g)}
              style={{background:activeGroup===g?"rgba(245,200,66,0.15)":"rgba(255,255,255,0.04)",
                border:"1px solid "+(activeGroup===g?"rgba(245,200,66,0.4)":"rgba(255,255,255,0.08)"),
                borderRadius:20,padding:"5px 14px",cursor:"pointer",
                color:activeGroup===g?"#f5c842":"#a09070",
                fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,fontSize:12}}>
              {g}{g!=="Alla"&&<span style={{marginLeft:4,opacity:.6}}>({(userGroups[g]||[]).filter(n=>leaderboard.some(e=>e.name===n)).length})</span>}
            </button>
          ))}
        </div>
      )}

      {ranked.length===0?(
        <p className="ss" style={{color:"#60504a",textAlign:"center",padding:"60px 0"}}>
          {activeGroup==="Alla"?"Inga tippare annu!":"Inga tippare i den har gruppen annu."}
        </p>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {ranked.map((e,i)=>{
            const medal = i===0?"#f5c842":i===1?"#c0c0c0":i===2?"#cd7f32":null;
            return(
              <div key={e.name} style={{background:i===0?"rgba(245,200,66,0.08)":"rgba(255,255,255,0.04)",
                border:"1px solid "+(i===0?"rgba(245,200,66,0.3)":"rgba(255,255,255,0.07)"),
                borderRadius:11,padding:"13px 20px",display:"flex",alignItems:"center",gap:14}}>
                <span className="pf" style={{fontSize:i<3?20:14,minWidth:32,textAlign:"center",
                  fontWeight:700,color:medal||"#60504a"}}>
                  {i===0?"1.":i===1?"2.":i===2?"3.":`#${e.rank}`}
                </span>
                <div style={{flex:1}}>
                  <div className="pf" style={{fontSize:16,fontWeight:700,color:i===0?"#f5c842":"#f0e6d3"}}>{e.name}</div>
                  <div className="ss" style={{fontSize:11,color:"#60504a",marginTop:2}}>
                    {e.tipped} matcher tippade
                    {e.podiumPoints>0&&<span style={{color:"#80a8f0",marginLeft:6}}>+{e.podiumPoints}p prispall</span>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="pf" style={{fontSize:24,fontWeight:900,color:medal||"#f0e6d3"}}>{e.points}</div>
                  <div className="ss" style={{fontSize:10,color:"#60504a"}}>poang</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// RESULTAT-VY
function ResultsView({results, getTeams, getDisplay, placements, bestThirds, deadlines={}}) {
  const [tab, setTab] = useState("groups");
  const [groupSubTab, setGroupSubTab] = useState("omgang1");
  const [selGroup, setSelGroup] = useState("A");
  const [koPhase, setKoPhase] = useState("Sextondelsfinal");

  // Helper: label for a knockout match (e.g. "Vinnare grupp E - Tvåan grupp F")
  function koLabel(m) {
    function keyLabel(key) {
      if (/^[A-L]0$/.test(key)) return "Etta grupp "+key[0];
      if (/^[A-L]1$/.test(key)) return "Tvåan grupp "+key[0];
      if (/^THIRD_[1-8]$/.test(key)) return "Bästa trea #"+key[6];
      if (key.endsWith("L")) return "Förlorare "+key.slice(0,-1);
      return "Vinnare "+key;
    }
    return keyLabel(m.homeKey)+" vs "+keyLabel(m.awayKey);
  }

  function renderGroupTable(group) {
    const matches=GROUP_MATCHES.filter(m=>m.group===group);
    const standing=calcGroupStandings(group,results);
    const played=matches.filter(m=>{const r=results[m.id];return r&&r.home!=""&&r.away!="";}).length;
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
                    background:adv?"rgba(245,200,66,0.04)":isThird?"rgba(80,120,220,0.04)":"transparent"}}>
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
        <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"10px 14px",display:"flex",flexDirection:"column",gap:5}}>
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

  function renderRoundMatches(round) {
    const rMatches = sortByDeadline(getMatchesForRound(round), deadlines);
    const groups = [...new Set(rMatches.map(m=>m.group))].sort();
    return(
      <div>
        {groups.map(g=>{
          const gMatches = rMatches.filter(m=>m.group===g);
          return(
            <div key={g} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span className="ss" style={{fontSize:11,fontWeight:700,color:"#f5c842",textTransform:"uppercase",letterSpacing:.6}}>Grupp {g}</span>
                <div style={{flex:1,height:1,background:"rgba(255,255,255,0.06)"}}/>
              </div>
              {gMatches.map(m=>{
                const r=results[m.id]; const played=r&&r.home!=""&&r.away!="";
                return(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 2px",marginBottom:4}}>
                    <span className="fc">{gc(m.home)}</span>
                    <span className="ss" style={{fontSize:12,fontWeight:600,flex:1,color:"#d0c8bc",textAlign:"right"}}>{dn(m.home)}</span>
                    <div style={{minWidth:64,textAlign:"center",background:played?"rgba(255,255,255,0.09)":"rgba(255,255,255,0.03)",
                      border:"1px solid "+(played?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"),borderRadius:8,padding:"4px 10px"}}>
                      {played?<span className="pf" style={{fontSize:15,fontWeight:700,color:"#f0e6d3"}}>{r.home} - {r.away}</span>
                        :<span className="ss" style={{fontSize:11,color:"#50403a"}}>vs</span>}
                    </div>
                    <span className="ss" style={{fontSize:12,fontWeight:600,flex:1,color:"#d0c8bc"}}>{dn(m.away)}</span>
                    <span className="fc">{gc(m.away)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  const koPhases=["Sextondelsfinal","Attondelsfinaler","Kvartsfinal","Semifinal","Bronsmatch","Final"];
  const koMatches=sortByDeadline(KNOCKOUT_ALL.filter(m=>m.phase===koPhase), deadlines);

  return(
    <div>
      <h2 className="pf" style={{fontSize:28,color:"#f5c842",fontWeight:700,marginBottom:6}}>Resultat</h2>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:22}}>Officiella matchresultat och gruppställningar</p>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:22}}>
        {[["groups","Gruppspel"],["knockout","Slutspel"],["thirds","Bästa treor"]].map(([k,l])=>(
          <button key={k} className={"tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* -- GRUPPSPEL -- */}
      {tab==="groups"&&(
        <div>
          {/* Sub-tabs: Omgång 1/2/3 + Per grupp */}
          <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:18}}>
            {[["omgang1","Omgång 1"],["omgang2","Omgång 2"],["omgang3","Omgång 3"],["pergrupp","Per grupp"]].map(([k,l])=>(
              <button key={k} className={"tab"+(groupSubTab===k?" active":"")} onClick={()=>setGroupSubTab(k)}>{l}</button>
            ))}
          </div>
          {groupSubTab==="omgang1"&&renderRoundMatches(1)}
          {groupSubTab==="omgang2"&&renderRoundMatches(2)}
          {groupSubTab==="omgang3"&&renderRoundMatches(3)}
          {groupSubTab==="pergrupp"&&(
            <div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:20}}>
                {Object.keys(GROUPS).map(g=>(
                  <button key={g} className={"gbtn"+(selGroup===g?" active":"")} onClick={()=>setSelGroup(g)}>Grupp {g}</button>
                ))}
              </div>
              {renderGroupTable(selGroup)}
              <p className="ss" style={{fontSize:11,color:"#504840",marginTop:-8}}>&gt; = vidare | * = bästa trea (vidare)</p>
            </div>
          )}
        </div>
      )}

      {/* -- SLUTSPEL -- */}
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
              const r=results[m.id]; const played=r&&r.home!=""&&r.away!="";
              const gh=played?parseInt(r.home):null; const ga=played?parseInt(r.away):null;
              const homeWon=played&&gh>ga; const awayWon=played&&ga>gh;
              const ht=getTeams(m.id).home; const at=getTeams(m.id).away;
              const matchLabel=koLabel(m);
              return(
                <div key={m.id} style={{background:played?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.03)",
                  border:"1px solid "+(played?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)"),
                  borderRadius:11,padding:"12px 18px"}}>
                  {!played&&<p className="ss" style={{fontSize:10,color:"#50403a",marginBottom:6,textAlign:"center"}}>{matchLabel}</p>}
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -- BÄSTA TREOR -- */}
      {tab==="thirds"&&(
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            De 8 bästa treorna kvalificerar sig till sextondelsfinalerna.
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
                        color:advances?"#80a8f0":"#60504a",fontWeight:700,fontSize:12}}>{advances?rank+1:"-"}</td>
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
        </div>
      )}
    </div>
  );
}


// ADMIN GRUPPER
function AdminGroupsView({userGroups, saveUserGroups, participants}) {
  const [newGroupName, setNewGroupName] = useState("");
  const [err, setErr] = useState("");
  const allNames = Object.keys(participants).sort();

  function addGroup() {
    const name = newGroupName.trim();
    if(!name){setErr("Ange ett gruppnamn.");return;}
    if(userGroups[name]){setErr("Gruppen finns redan.");return;}
    saveUserGroups({...userGroups,[name]:[]});
    setNewGroupName("");setErr("");
  }
  function deleteGroup(g) {
    const upd={...userGroups};delete upd[g];
    saveUserGroups(upd);
  }
  function toggleMember(group, name) {
    const members = userGroups[group]||[];
    const upd = members.includes(name)?members.filter(m=>m!==name):[...members,name];
    saveUserGroups({...userGroups,[group]:upd});
  }

  return(
    <div>
      <h3 className="pf" style={{fontSize:18,color:"#f5c842",marginBottom:16}}>Hantera grupper</h3>
      <p className="ss" style={{fontSize:12,color:"#60504a",marginBottom:18}}>
        Skapa grupper och tilldela deltagare. Deltagare kan ocksa ga med sjalva i tippningsvyn.
      </p>

      {/* Create group */}
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        <input value={newGroupName} onChange={e=>{setNewGroupName(e.target.value);setErr("");}}
          placeholder="Nytt gruppnamn..." onKeyDown={e=>e.key==="Enter"&&addGroup()}
          style={{flex:1,minWidth:160}}/>
        <button className="btn" onClick={addGroup} style={{whiteSpace:"nowrap"}}>Skapa grupp</button>
      </div>
      {err&&<p className="ss" style={{color:"#e07070",fontSize:12,marginTop:-16,marginBottom:12}}>{err}</p>}

      {Object.keys(userGroups).length===0&&(
        <p className="ss" style={{color:"#60504a"}}>Inga grupper skapade annu.</p>
      )}

      {/* Group cards */}
      {Object.keys(userGroups).sort().map(g=>(
        <div key={g} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:10,padding:"14px 16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span className="pf" style={{fontSize:15,color:"#f5c842",fontWeight:700}}>{g}</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span className="ss" style={{fontSize:11,color:"#60504a"}}>{(userGroups[g]||[]).length} medlemmar</span>
              <button onClick={()=>deleteGroup(g)}
                style={{background:"rgba(180,50,50,0.2)",border:"1px solid rgba(180,50,50,0.3)",
                  borderRadius:5,padding:"3px 10px",cursor:"pointer",fontSize:11,color:"#e07070",
                  fontFamily:"'Source Sans 3',sans-serif"}}>Ta bort grupp</button>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {allNames.map(name=>{
              const isMember=(userGroups[g]||[]).includes(name);
              return(
                <button key={name} onClick={()=>toggleMember(g,name)}
                  style={{background:isMember?"rgba(245,200,66,0.15)":"rgba(255,255,255,0.04)",
                    border:"1px solid "+(isMember?"rgba(245,200,66,0.4)":"rgba(255,255,255,0.08)"),
                    borderRadius:16,padding:"4px 12px",cursor:"pointer",
                    color:isMember?"#f5c842":"#a09070",
                    fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:isMember?700:400}}>
                  {isMember?"OK ":""}{name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ADMIN RESULTAT - helper components (top-level to avoid hooks-in-nested-components error)
function AdminMatchRow({m, results, handleResult, getDisplay, getTeams, matchOverrides, saveMatchOverride,
  openOverrides, toggleOverride, allTeams, placements}) {
  const r = results[m.id]||{home:"",away:""};
  const done = r.home!=""&&r.away!="";
  const disp = getDisplay(m);
  const isKO = m.phase!=="Grupp";
  const autoTeams = isKO ? getTeams(m.id) : {home:m.home, away:m.away};
  const ht = autoTeams.home;
  const at = autoTeams.away;
  const hasHomeOverride = matchOverrides[m.id+"_home"];
  const hasAwayOverride = matchOverrides[m.id+"_away"];
  const showOverride = !!openOverrides[m.id];
  const matchLbl = isKO ? koLabel(m, placements, getTeams) : null;

  // For group matches: show home/away label
  function groupTeamLabel(team, key) {
    const lbl = labelFromKey(key)||"";
    return lbl;
  }

  return(
    <div style={{background:done?"rgba(80,200,120,0.06)":"rgba(255,255,255,0.04)",
      border:"1px solid "+(done?"rgba(80,200,120,0.25)":"rgba(255,255,255,0.07)"),
      borderRadius:9,padding:"10px 14px",marginBottom:6}}>
      {matchLbl&&<p className="ss" style={{fontSize:10,color:"#60504a",marginBottom:6,textAlign:"center"}}
        dangerouslySetInnerHTML={{__html:matchLbl}}/>}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {ht&&<span className="fc">{gc(ht)}</span>}
        <span className="tn" style={{textAlign:"right",color:hasHomeOverride?"#f5c842":"#f0e6d3"}}>{disp.home}</span>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <input type="number" min="0" max="20" value={r.home}
            onChange={e=>handleResult(m.id,"home",e.target.value)}/>
          <span className="ss" style={{color:"#60504a",fontSize:11}}>-</span>
          <input type="number" min="0" max="20" value={r.away}
            onChange={e=>handleResult(m.id,"away",e.target.value)}/>
        </div>
        <span className="tn" style={{color:hasAwayOverride?"#f5c842":"#f0e6d3"}}>{disp.away}</span>
        {at&&<span className="fc">{gc(at)}</span>}
        {done&&<span style={{fontSize:12,color:"#50c878",fontFamily:"'Source Sans 3',sans-serif",fontWeight:700}}>OK</span>}
        {isKO&&(
          <button onClick={()=>toggleOverride(m.id)}
            style={{background:"rgba(245,200,66,0.1)",border:"1px solid rgba(245,200,66,0.2)",borderRadius:5,
              padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#f5c842",
              fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,whiteSpace:"nowrap"}}>
            {showOverride?"Stang":"Andra lag"}
          </button>
        )}
      </div>
      {isKO&&showOverride&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",
          display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <div>
            <p className="ss" style={{fontSize:10,color:"#60504a",marginBottom:4}}>Hemmalag:</p>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <select value={matchOverrides[m.id+"_home"]||""}
                onChange={e=>saveMatchOverride(m.id,"home",e.target.value)}
                style={{fontSize:12,padding:"4px 8px"}}>
                <option value="">-- Auto ({ht?dn(ht):"okant"}) --</option>
                {allTeams.map(t=><option key={t} value={t}>{dn(t)}</option>)}
              </select>
              {hasHomeOverride&&<button onClick={()=>saveMatchOverride(m.id,"home","")}
                style={{background:"rgba(180,50,50,0.2)",border:"1px solid rgba(180,50,50,0.3)",
                  borderRadius:4,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#e07070",
                  fontFamily:"'Source Sans 3',sans-serif"}}>Aterstall</button>}
            </div>
          </div>
          <div>
            <p className="ss" style={{fontSize:10,color:"#60504a",marginBottom:4}}>Bortalag:</p>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <select value={matchOverrides[m.id+"_away"]||""}
                onChange={e=>saveMatchOverride(m.id,"away",e.target.value)}
                style={{fontSize:12,padding:"4px 8px"}}>
                <option value="">-- Auto ({at?dn(at):"okant"}) --</option>
                {allTeams.map(t=><option key={t} value={t}>{dn(t)}</option>)}
              </select>
              {hasAwayOverride&&<button onClick={()=>saveMatchOverride(m.id,"away","")}
                style={{background:"rgba(180,50,50,0.2)",border:"1px solid rgba(180,50,50,0.3)",
                  borderRadius:4,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#e07070",
                  fontFamily:"'Source Sans 3',sans-serif"}}>Aterstall</button>}
            </div>
          </div>
          {(hasHomeOverride||hasAwayOverride)&&(
            <p className="ss" style={{fontSize:10,color:"#f5c842"}}>Manuell override aktiv</p>
          )}
        </div>
      )}
    </div>
  );
}

function AdminResults({results, handleResult, getTeams, getDisplay, placements, deadlines={}, matchOverrides={}, saveMatchOverride}) {
  const [phase, setPhase] = useState("omgang1");
  const [group, setGroup] = useState("A");
  const [openOverrides, setOpenOverrides] = useState({});

  const allTeams = Object.values(GROUPS).flat().sort((a,b)=>dn(a).localeCompare(dn(b)));

  function toggleOverride(id) { setOpenOverrides(prev=>({...prev,[id]:!prev[id]})); }

  const rowProps = {results, handleResult, getDisplay, getTeams, matchOverrides, saveMatchOverride,
    openOverrides, toggleOverride, allTeams, placements};

  const koPhases = ["Sextondelsfinal","Attondelsfinaler","Kvartsfinal","Semifinal","Bronsmatch","Final"];
  const koMatches = sortByDeadline(KNOCKOUT_ALL.filter(m=>m.phase===phase), deadlines);

  function renderRound(round) {
    const ms = sortByDeadline(getMatchesForRound(round), deadlines);
    const groups = [...new Set(ms.map(m=>m.group))].sort();
    return(
      <div>
        {groups.map(g=>(
          <div key={g} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span className="ss" style={{fontSize:11,fontWeight:700,color:"#f5c842",textTransform:"uppercase",letterSpacing:.6}}>Grupp {g}</span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.06)"}}/>
            </div>
            {ms.filter(m=>m.group===g).map(m=>(
              <AdminMatchRow key={m.id} m={m} {...rowProps}/>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return(
    <div>
      <div className="scroll-x" style={{marginBottom:16}}>
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",minWidth:"max-content"}}>
          {[["omgang1","Omgang 1"],["omgang2","Omgang 2"],["omgang3","Omgang 3"],["pergrupp","Per grupp"],
            ...koPhases.map(p=>[p,p])].map(([k,l])=>(
            <button key={k} className={"tab"+(phase===k?" active":"")} onClick={()=>setPhase(k)}>{l}</button>
          ))}
        </div>
      </div>

      {phase==="omgang1"&&renderRound(1)}
      {phase==="omgang2"&&renderRound(2)}
      {phase==="omgang3"&&renderRound(3)}

      {phase==="pergrupp"&&(
        <div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} className={"gbtn"+(group===g?" active":"")} onClick={()=>setGroup(g)}>Grupp {g}</button>
            ))}
          </div>
          {sortByDeadline(GROUP_MATCHES.filter(m=>m.group===group), deadlines).map(m=>(
            <AdminMatchRow key={m.id} m={m} {...rowProps}/>
          ))}
        </div>
      )}

      {koPhases.includes(phase)&&(
        <div>
          {koMatches.length===0
            ?<p className="ss" style={{color:"#60504a",fontSize:13}}>Inga matcher i denna fas.</p>
            :koMatches.map(m=>(
              <AdminMatchRow key={m.id} m={m} {...rowProps}/>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ADMIN-VY
function AdminView({results,deadlines,thirdOverrides,tipPhase,setTipPhase,tipGroup,setTipGroup,
  adminTab,setAdminTab,dlInput,setDlInput,rdlInput,setRdlInput,
  filteredMatches,getDisplay,getTeams,handleResult,setDeadline,rmDeadline,
  bulkDeadline,bulkRoundDeadline,isLocked,fmtDl,
  placements,bestThirds,handleThirdOverride,participants,deleteParticipant,resetPassword,
  approved,toggleApproved,
  podiumDeadline,podiumResults,podiumLocked,savePodiumDeadline,savePodiumResults,podiumTips,
  siteInfo,saveSiteInfo,
  matchOverrides,saveMatchOverride,
  visitorStats={},
  userGroups={}, saveUserGroups}) {

  const [pdlInput, setPdlInput] = useState(podiumDeadline?new Date(podiumDeadline).toISOString().slice(0,16):"");
  useEffect(()=>{ if(podiumDeadline) setPdlInput(new Date(podiumDeadline).toISOString().slice(0,16)); },[podiumDeadline]);
  const allTeams = Object.values(GROUPS).flat().sort((a,b)=>a.localeCompare(b));

  return(
    <div>
      <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700,marginBottom:16}}>Admin - P14 HIKs VM-tipp 2026</h2>

      {/* Visitor stats bar */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
        {[
          {label:"Totalt antal besok",value:visitorStats.totalVisits||0,icon:"&#128100;"},
          {label:"Unika besokare",value:visitorStats.uniqueCount||0,icon:"&#127775;"},
          {label:"Senaste besok",value:visitorStats.lastVisit?new Date(visitorStats.lastVisit).toLocaleString("sv-SE",{dateStyle:"short",timeStyle:"short"}):"--",icon:"&#128336;"},
        ].map(({label,value,icon})=>(
          <div key={label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span dangerouslySetInnerHTML={{__html:icon}} style={{fontSize:18}}/>
            <div>
              <div className="pf" style={{fontSize:18,color:"#f5c842",fontWeight:700,lineHeight:1}}>{value}</div>
              <div className="ss" style={{fontSize:10,color:"#60504a",marginTop:2}}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:22,flexWrap:"wrap"}}>
        {[["results","Resultat"],["thirds","Treornas matcher"],["deadlines","Deadlines"],["podium","Prispall"],["participants","Deltagare"],["groups","Grupper"],["siteinfo","Startsida"]].map(([k,l])=>(
          <button key={k} className={"tab"+(adminTab===k?" active":"")} onClick={()=>setAdminTab(k)}>{l}</button>
        ))}
      </div>

      {adminTab==="results"&&(
        <AdminResults
          results={results} handleResult={handleResult} getTeams={getTeams} getDisplay={getDisplay}
          placements={placements} deadlines={deadlines}
          matchOverrides={matchOverrides} saveMatchOverride={saveMatchOverride}
        />
      )}

      {adminTab==="thirds"&&(
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            När gruppspelet ar klart laser FIFA bracketen (27 juni). Tilldela de 8 basta treorna till rätt gruppsegrare nedän.
          </p>
          <div style={{background:"rgba(245,200,66,0.05)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:9,padding:"12px 16px",marginBottom:20}}>
            <p className="ss" style={{fontSize:12,color:"#f5c842",fontWeight:700,marginBottom:8}}>Automatisk ranking (topp 8 treor just nu):</p>
            {bestThirds.length===0
              ?<p className="ss" style={{fontSize:12,color:"#60504a"}}>Inga gruppresultat registrerade än.</p>
              :bestThirds.map((t,i)=>(
                <div key={t.team} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span className="fc">{gc(t.team)}</span>
                  <span className="ss" style={{fontSize:12,color:"#f0e6d3",fontWeight:600}}>{i+1}. {dn(t.team)}</span>
                  <span className="ss" style={{fontSize:11,color:"#60504a"}}>({t.pts}p - Grupp {t.group})</span>
                </div>
              ))
            }
          </div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:14,lineHeight:1.7}}>
            Varje trea moter en gruppsegrare. Välj rätt trea for varje match när FIFA offentliggor bracketen den 27 juni.
          </p>
          {R32_THIRDS.map(m=>{
            const groupWinner = labelFromKey(m.homeKey);
            return(
              <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 16px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
                  <p className="ss" style={{fontSize:12,color:"#f5c842",fontWeight:700}}>{m.id}</p>
                  <p className="ss" style={{fontSize:11,color:"#60504a"}}>{m.thirdInfo}</p>
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{background:"rgba(245,200,66,0.08)",border:"1px solid rgba(245,200,66,0.2)",borderRadius:6,padding:"6px 12px"}}>
                    <span className="ss" style={{fontSize:12,fontWeight:700,color:"#f5c842"}}>{groupWinner}</span>
                  </div>
                  <span className="ss" style={{fontSize:13,color:"#60504a"}}>vs</span>
                  <div style={{flex:1,minWidth:160}}>
                    <p className="ss" style={{fontSize:10,color:"#60504a",marginBottom:4}}>Välj trea ({m.awayKey}):</p>
                    <select value={thirdOverrides[m.awayKey]||""} onChange={e=>handleThirdOverride(m.awayKey,e.target.value)} style={{width:"100%"}}>
                      <option value="">-- Välj trea --</option>
                      {bestThirds.map(t=><option key={t.team} value={t.team}>{dn(t.team)} (Grupp {t.group}, {t.pts}p)</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adminTab==="deadlines"&&(
        <div>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:18,lineHeight:1.7}}>
            Sätt deadline per match eller per omgång. När deadline passerar låses tipsen automatiskt.
          </p>
          {/* Bulk per omgång */}
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.14)",borderRadius:10,padding:"16px",marginBottom:20}}>
            <p className="ss" style={{fontSize:13,fontWeight:700,color:"#f5c842",marginBottom:4}}>Sätt deadline for hel omgång</p>
            <p className="ss" style={{fontSize:11,color:"#60504a",marginBottom:12}}>Forinstallda tider = första matchen i varje omgång. Ändras vid behov.</p>
            {[1,2,3].map(r=>(
              <div key={r} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
                <span className="ss" style={{fontSize:13,fontWeight:700,color:"#f0e6d3",minWidth:80}}>Omgång {r}:</span>
                <span className="ss" style={{fontSize:11,color:"#60504a",flex:1}}>{getMatchesForRound(r).length} matcher</span>
                <input type="datetime-local" value={rdlInput["r"+r]||""}
                  onChange={e=>setRdlInput(prev=>({...prev,["r"+r]:e.target.value}))}/>
                <button className="btn btn-sm" onClick={()=>{
                  const v=rdlInput["r"+r]; if(v) bulkRoundDeadline(r,new Date(v).toISOString());
                }}>Sätt for alla {getMatchesForRound(r).length} matcher</button>
              </div>
            ))}
          </div>
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
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredMatches.map(m=>{
              const disp=getDisplay(m); const dl=deadlines[m.id];
              const locked=isLocked(m.id);
              const defaultDl=DEFAULT_DEADLINES[m.id];
              const curVal=dlInput[m.id]||(dl?new Date(dl).toISOString().slice(0,16):defaultDl?new Date(defaultDl).toISOString().slice(0,16):"");
              return(
                <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"11px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:8}}>
                    <span className="ss" style={{fontSize:13,fontWeight:600,color:"#f0e6d3",flex:1}}>{disp.home} - {disp.away}</span>
                    {locked&&<span className="lock-badge">Last</span>}
                    {!locked&&dl&&<span className="open-badge">Stänger {fmtDl(m.id)}</span>}
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

      {adminTab==="podium"&&(
        <div>
          <h3 className="pf" style={{fontSize:18,color:"#f5c842",fontWeight:700,marginBottom:6}}>Prispall-administration</h3>
          <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:20,lineHeight:1.7}}>
            Sätt deadline for Tippa prispall och registrera officiellt utfall när VM ar klart.
          </p>

          {/* Deadline */}
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,200,66,0.14)",borderRadius:10,padding:"16px",marginBottom:20}}>
            <p className="ss" style={{fontSize:13,fontWeight:700,color:"#f5c842",marginBottom:10}}>Deadline for Tippa prispall</p>
            <p className="ss" style={{fontSize:11,color:"#a09070",marginBottom:12}}>Sätt samma deadline som Omgång 1 (fore första matchen).</p>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <input type="datetime-local" value={pdlInput}
                onChange={e=>setPdlInput(e.target.value)}/>
              <button className="btn btn-sm" onClick={()=>{if(pdlInput)savePodiumDeadline(new Date(pdlInput).toISOString());}}>Spara deadline</button>
              {podiumLocked&&<span className="lock-badge">Last nu</span>}
              {!podiumLocked&&podiumDeadline&&<span className="open-badge">Stänger {new Date(podiumDeadline).toLocaleString("sv-SE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
            </div>
          </div>

          {/* Officiellt utfall */}
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"16px",marginBottom:20}}>
            <p className="ss" style={{fontSize:13,fontWeight:700,color:"#f5c842",marginBottom:10}}>Registrera officiellt utfall (efter finalen)</p>
            {[
              {key:"winner",label:"Segrare (VM-guld)",pts:20},
              {key:"second",label:"Två (finalförlorare)",pts:15},
              {key:"third", label:"Trea (bronsmatch-vinnare)",pts:10},
            ].map(s=>(
              <div key={s.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                <span className="ss" style={{fontSize:13,fontWeight:600,color:"#f0e6d3",minWidth:200}}>{s.label} ({s.pts}p):</span>
                <select value={podiumResults[s.key]||""} onChange={e=>savePodiumResults(s.key,e.target.value)} style={{flex:1,minWidth:160}}>
                  <option value="">-- Välj lag --</option>
                  {allTeams.map(t=><option key={t} value={t}>{dn(t)}</option>)}
                </select>
                {podiumResults[s.key]&&<span className="ss" style={{fontSize:12,color:"#50c878",fontWeight:700}}>{dn(podiumResults[s.key])}</span>}
              </div>
            ))}
          </div>

          {/* Oversikt over deltagarnas tips */}
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"16px"}}>
            <p className="ss" style={{fontSize:13,fontWeight:700,color:"#f5c842",marginBottom:10}}>Deltagarnas prispall-tips</p>
            {Object.keys(podiumTips).length===0?(
              <p className="ss" style={{color:"#60504a",fontSize:12}}>Inga prispall-tips inlagda än.</p>
            ):(
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                    {["Deltagare","Segrare","Två","Trea","Poäng"].map(h=>(
                      <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#60504a",fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(podiumTips).sort(([a],[b])=>a.localeCompare(b)).map(([name,tip])=>{
                    let pts=0;
                    if(podiumResults.winner&&tip.winner===podiumResults.winner) pts+=20;
                    if(podiumResults.second&&tip.second===podiumResults.second) pts+=15;
                    if(podiumResults.third&&tip.third===podiumResults.third)    pts+=10;
                    return(
                      <tr key={name} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <td style={{padding:"7px 10px",fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,color:"#f0e6d3"}}>{name}</td>
                        <td style={{padding:"7px 10px",fontFamily:"'Source Sans 3',sans-serif",color:podiumResults.winner?(tip.winner===podiumResults.winner?"#50c878":"#e07070"):"#a09070"}}>{dn(tip.winner)||"-"}</td>
                        <td style={{padding:"7px 10px",fontFamily:"'Source Sans 3',sans-serif",color:podiumResults.second?(tip.second===podiumResults.second?"#50c878":"#e07070"):"#a09070"}}>{dn(tip.second)||"-"}</td>
                        <td style={{padding:"7px 10px",fontFamily:"'Source Sans 3',sans-serif",color:podiumResults.third?(tip.third===podiumResults.third?"#50c878":"#e07070"):"#a09070"}}>{dn(tip.third)||"-"}</td>
                        <td style={{padding:"7px 10px",fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,color:pts>0?"#f5c842":"#a09070"}}>{pts>0?"+"+pts+"p":"-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {adminTab==="participants"&&(
        <AdminParticipants participants={participants} deleteParticipant={deleteParticipant} resetPassword={resetPassword} approved={approved} toggleApproved={toggleApproved}/>
      )}

      {adminTab==="siteinfo"&&(
        <SiteInfoAdmin siteInfo={siteInfo} saveSiteInfo={saveSiteInfo}/>
      )}

      {adminTab==="groups"&&(
        <AdminGroupsView userGroups={userGroups} saveUserGroups={saveUserGroups} participants={participants}/>
      )}
    </div>
  );
}

// STARTSIDA ADMIN
function SiteInfoAdmin({siteInfo, saveSiteInfo}) {
  const [msg, setMsg] = useState(siteInfo.message||"");
  const [pot, setPot] = useState(siteInfo.prizePot||"");
  const [saved, setSaved] = useState("");
  // Sync with Firebase data when it loads
  useEffect(()=>{ setMsg(siteInfo.message||""); setPot(siteInfo.prizePot||""); },[siteInfo.message,siteInfo.prizePot]);

  async function handleSave() {
    await saveSiteInfo({message: msg, prizePot: pot});
    setSaved("Sparat!"); setTimeout(()=>setSaved(""),2000);
  }

  return(
    <div>
      <h3 className="pf" style={{fontSize:18,color:"#f5c842",fontWeight:700,marginBottom:6}}>Startsida - meddelande och vinstpott</h3>
      <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:24,lineHeight:1.7}}>
        Meddelandet och vinstpotten visas pa startsidan for alla besökare. Lamma blankt for att döljas.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:560}}>
        <div>
          <p className="ss" style={{fontSize:13,fontWeight:700,color:"#f5c842",marginBottom:8}}>Meddelande fr&aring;n Admin</p>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)}
            placeholder="Skriv ett meddelande till deltagarna, t.ex. info om regler, deadlines etc."
            style={{width:"100%",minHeight:100,background:"rgba(255,255,255,0.07)",
              border:"1px solid rgba(255,200,80,0.25)",borderRadius:6,color:"#f0e6d3",
              padding:"10px 12px",fontSize:14,fontFamily:"'Source Sans 3',sans-serif",
              outline:"none",resize:"vertical",lineHeight:1.6}}/>
          <p className="ss" style={{fontSize:11,color:"#60504a",marginTop:4}}>Visas i en gul ruta pa startsidän. Lamma blankt for att döljas.</p>
        </div>
        <div>
          <p className="ss" style={{fontSize:13,fontWeight:700,color:"#50c878",marginBottom:8}}>Vinstpott</p>
          <input type="text" placeholder="T.ex. 500 kr eller En runda pa krogen!" value={pot}
            onChange={e=>setPot(e.target.value)} style={{width:"100%"}}/>
          <p className="ss" style={{fontSize:11,color:"#60504a",marginTop:4}}>Visas i en gron ruta pa startsidän. Lamma blankt for att döljas.</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="btn" onClick={handleSave}>Spara</button>
          {saved&&<span className="ss" style={{fontSize:13,color:"#50c878"}}>{saved}</span>}
        </div>
      </div>
    </div>
  );
}

// ADMIN DELTAGARE
function AdminParticipants({participants, deleteParticipant, resetPassword, approved, toggleApproved}) {
  const [resetName, setResetName] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwOk, setPwOk] = useState("");

  async function handleReset() {
    if(!newPw||newPw.length<2){setPwErr("Ange minst 2 tecken.");return;}
    if(newPw!==newPw2){setPwErr("Lösenorden matchar inte.");return;}
    const ok = await resetPassword(resetName, newPw);
    if(ok){setPwOk("Lösenord återstalt!"); setNewPw(""); setNewPw2(""); setPwErr("");
      setTimeout(()=>{setPwOk("");setResetName(null);},2000);}
    else setPwErr("Nagot gick fel.");
  }

  return(
    <div>
      <h3 className="pf" style={{fontSize:18,color:"#f5c842",fontWeight:700,marginBottom:6}}>Hantera deltagare</h3>
      <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:20}}>
        {Object.keys(participants).length} registrerade deltagare.
      </p>
      {Object.keys(participants).length===0?(
        <p className="ss" style={{color:"#60504a"}}>Inga deltagare än.</p>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {Object.keys(participants).sort().map(name=>{
            const tips=participants[name]||{};
            const tipped=[...GROUP_MATCHES,...KNOCKOUT_ALL].filter(m=>{const t=tips[m.id];return t&&t.home!=""&&t.away!="";}).length;
            const isResetting=resetName===name;
            return(
              <div key={name} style={{background:"rgba(255,255,255,0.04)",border:"1px solid "+(isResetting?"rgba(245,200,66,0.3)":approved[name]?"rgba(80,200,120,0.25)":"rgba(255,255,255,0.07)"),borderRadius:9,padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:approved[name]?"rgba(80,200,120,0.1)":"rgba(255,255,255,0.05)",border:"1px solid "+(approved[name]?"rgba(80,200,120,0.3)":"rgba(255,255,255,0.1)"),borderRadius:6,padding:"6px 12px"}}>
                    <input type="checkbox" checked={!!approved[name]} onChange={()=>toggleApproved(name)}
                      style={{width:16,height:16,accentColor:"#50c878",cursor:"pointer"}}/>
                    <span className="ss" style={{fontSize:12,color:approved[name]?"#50c878":"#a09070",fontWeight:700,whiteSpace:"nowrap"}}>
                      {approved[name]?"Godkänd":"Ej godkänd"}
                    </span>
                  </label>
                  <div style={{flex:1}}>
                    <div className="pf" style={{fontSize:15,fontWeight:700,color:"#f0e6d3"}}>{name}</div>
                    <div className="ss" style={{fontSize:11,color:"#60504a",marginTop:2}}>{tipped} matcher tippade</div>
                  </div>
                  <button className="btn btn-sm" style={{background:"rgba(245,200,66,0.15)",color:"#f5c842",border:"1px solid rgba(245,200,66,0.3)"}}
                    onClick={()=>{setResetName(isResetting?null:name);setNewPw("");setNewPw2("");setPwErr("");setPwOk("");}}>
                    {isResetting?"Avbryt":"Återställ lösenord"}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={()=>deleteParticipant(name)}>Ta bort</button>
                </div>
                {isResetting&&(
                  <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                    <p className="ss" style={{fontSize:12,color:"#a09070",marginBottom:10}}>Sätt nytt lösenord for {name}:</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <input type="password" placeholder="Nytt lösenord" value={newPw}
                        onChange={e=>{setNewPw(e.target.value);setPwErr("");setPwOk("");}} style={{flex:1,minWidth:140}}/>
                      <input type="password" placeholder="Bekräfta lösenord" value={newPw2}
                        onChange={e=>{setNewPw2(e.target.value);setPwErr("");setPwOk("");}} style={{flex:1,minWidth:140}}/>
                      <button className="btn btn-sm" onClick={handleReset}>Spara</button>
                    </div>
                    {pwErr&&<p className="err" style={{marginTop:8}}>{pwErr}</p>}
                    {pwOk&&<p className="ss" style={{marginTop:8,color:"#50c878",fontSize:12}}>{pwOk}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// SLUTSPELSTRAD
function BracketView({placements, results, getTeams, bestThirds}) {
  function renderTR(mid, side) {
    const match=KNOCKOUT_ALL.find(m=>m.id===mid)||{homeKey:"",awayKey:""};
    const {home,away}=getTeams(mid);
    const team=side==="home"?home:away;
    const r=results[mid];
    const rh=r?parseInt(r.home):NaN; const ra=r?parseInt(r.away):NaN;
    const hasScore=!isNaN(rh)&&!isNaN(ra);
    const won=hasScore&&((side==="home"&&rh>ra)||(side==="away"&&ra>rh));
    const keyLabel = side==="home"?match.homeKey:match.awayKey;
    function getOriginLabel(key) {
      if(/^[A-L]0$/.test(key)) return "Etta grupp "+key[0];
      if(/^[A-L]1$/.test(key)) return "Tvaan grupp "+key[0];
      if(/^THIRD_[1-8]$/.test(key)) return "Trea #"+key[6];
      return null;
    }
    const originLabel = getOriginLabel(keyLabel);
    return(
      <div style={{display:"flex",flexDirection:"column",gap:1,padding:"4px 8px",
        background:won?"rgba(245,200,66,0.1)":team?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",
        borderRadius:4,minWidth:170,border:"1px solid "+(won?"rgba(245,200,66,0.28)":"rgba(255,255,255,0.06)")}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {team&&<span className="fc" style={{fontSize:8}}>{gc(team)}</span>}
          <span style={{fontSize:10,fontFamily:"'Source Sans 3',sans-serif",fontWeight:600,
            color:team?(won?"#f5c842":"#f0e6d3"):"#50403a",flex:1,overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team?dn(team):"--"}</span>
          {hasScore&&<span style={{fontSize:10,fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,
            color:won?"#f5c842":"#70605a"}}>{side==="home"?rh:ra}</span>}
        </div>
        {originLabel&&<span style={{fontSize:8,fontFamily:"'Source Sans 3',sans-serif",
          color:"#50403a",paddingLeft:team?20:0}}>{originLabel}</span>}
      </div>
    );
  }
  function renderMB(mid){return<div style={{display:"flex",flexDirection:"column",gap:2}}>{renderTR(mid,"home")}{renderTR(mid,"away")}</div>;}
  function renderCol(children,pt=0){return<div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:pt}}>{children}</div>;}
  function renderH(t,gold=false){return<div style={{fontSize:8,fontFamily:"'Source Sans 3',sans-serif",color:gold?"#f5c842":"#60504a",textTransform:"uppercase",letterSpacing:.8,marginBottom:3,fontWeight:700}}>{t}</div>;}

  return(
    <div>
      <h2 className="pf" style={{fontSize:24,color:"#f5c842",fontWeight:700,marginBottom:6}}>Slutspelsträd</h2>
      <p className="ss" style={{fontSize:11,color:"#60504a",marginBottom:20}}>VM 2026: 32 lag - 5 omgangar till final</p>
      <p className="ss" style={{fontSize:11,color:"#80a8f0",marginBottom:16}}>
        * Trea (T) = en av de 8 basta treorna - admin placerar ut dem nar FIFA lastlar bracketen 27 juni
      </p>
      <div style={{overflowX:"auto",paddingBottom:16}}>
        <div style={{display:"flex",gap:6,alignItems:"flex-start",minWidth:1500}}>

          {/* LEFT R32 - Spain half */}
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {renderH("Sextondelsfinal")}
            {[["R32_1","R32_9"],["R32_2","R32_10"],["R32_3","R32_11"],["R32_4","R32_12"]].map(([a,b],i)=>(
              <div key={a} style={{height:220,display:"flex",flexDirection:"column",justifyContent:"space-around"}}>
                <div>{renderMB(a)}</div>
                <div>{renderMB(b)}</div>
              </div>
            ))}
          </div>

          {/* LEFT R16 */}
          <div style={{display:"flex",flexDirection:"column",gap:0,paddingTop:16}}>
            {renderH("Attondel")}
            {["R16_1","R16_2","R16_3","R16_4"].map((id,i)=>(
              <div key={id} style={{height:220,display:"flex",alignItems:"center"}}>{renderMB(id)}</div>
            ))}
          </div>

          {/* LEFT QF */}
          <div style={{display:"flex",flexDirection:"column",gap:0,paddingTop:16}}>
            {renderH("Kvartsfinal")}
            {["QF_1","QF_2"].map((id,i)=>(
              <div key={id} style={{height:440,display:"flex",alignItems:"center"}}>{renderMB(id)}</div>
            ))}
          </div>

          {/* LEFT SF */}
          <div style={{display:"flex",flexDirection:"column",paddingTop:16}}>
            {renderH("Semifinal")}
            <div style={{fontSize:9,fontFamily:"'Source Sans 3',sans-serif",color:"#60504a",marginBottom:4}}>14 jul</div>
            <div style={{height:880,display:"flex",alignItems:"center"}}>{renderMB("SF_1")}</div>
          </div>

          {/* MIDDLE: Final + Bronze */}
          <div style={{display:"flex",flexDirection:"column",paddingTop:16}}>
            {renderH("Final",true)}
            <div style={{height:880,display:"flex",alignItems:"center"}}>{renderMB("FINAL")}</div>
            <div style={{marginTop:8}}>
              {renderH("Bronsmatch")}
              <div style={{fontSize:9,fontFamily:"'Source Sans 3',sans-serif",color:"#60504a",marginBottom:4}}>18 jul</div>
              {renderMB("BRONS")}
            </div>
          </div>

          {/* RIGHT SF */}
          <div style={{display:"flex",flexDirection:"column",paddingTop:16}}>
            {renderH("Semifinal")}
            <div style={{fontSize:9,fontFamily:"'Source Sans 3',sans-serif",color:"#60504a",marginBottom:4}}>15 jul</div>
            <div style={{height:880,display:"flex",alignItems:"center"}}>{renderMB("SF_2")}</div>
          </div>

          {/* RIGHT QF */}
          <div style={{display:"flex",flexDirection:"column",gap:0,paddingTop:16}}>
            {renderH("Kvartsfinal")}
            {["QF_3","QF_4"].map((id,i)=>(
              <div key={id} style={{height:440,display:"flex",alignItems:"center"}}>{renderMB(id)}</div>
            ))}
          </div>

          {/* RIGHT R16 */}
          <div style={{display:"flex",flexDirection:"column",gap:0,paddingTop:16}}>
            {renderH("Attondel")}
            {["R16_5","R16_6","R16_7","R16_8"].map((id,i)=>(
              <div key={id} style={{height:220,display:"flex",alignItems:"center"}}>{renderMB(id)}</div>
            ))}
          </div>

          {/* RIGHT R32 - Argentina half */}
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {renderH("Sextondelsfinal")}
            {[["R32_5","R32_13"],["R32_6","R32_14"],["R32_7","R32_15"],["R32_8","R32_16"]].map(([a,b],i)=>(
              <div key={a} style={{height:220,display:"flex",flexDirection:"column",justifyContent:"space-around"}}>
                <div>{renderMB(a)}</div>
                <div>{renderMB(b)}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
      <div style={{marginTop:28,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
        <h3 className="ss" style={{fontSize:11,color:"#60504a",textTransform:"uppercase",letterSpacing:.9,marginBottom:14,fontWeight:700}}>Grupplaceringar</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {Object.keys(GROUPS).map(g=>{
            const e1=placements[g+"0"],e2=placements[g+"1"];
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
