import { useState, useEffect, useRef, useCallback } from "react";

const APP_PASSWORD   = "MUNCHY2026";
const CASHBACK_RATE  = 0.05; // 5% du montant en cagnotte
const MIN_PURCHASE   = 1;    // minimum 1€
const STORAGE_KEY    = "munchys-customers-v2";
const DICE_FACES     = ["","⚀","⚁","⚂","⚃","⚄","⚅"];

const C = {
  pink:"#FF3D7F", yellow:"#FFD600", blue:"#00C2FF", purple:"#9B51E0",
  green:"#00E676", bg:"#0D0D1A", card:"#16162A", cardLight:"#1E1E35",
  text:"#FFFFFF", muted:"#8888AA",
};

// Niveaux basés sur la cagnotte cumulée (€)
const TIERS = [
  { name:"Sucre",     min:0,   max:9.99,    color:"#C0C0C0", emoji:"🍬", discount:5  },
  { name:"Caramel",   min:10,  max:24.99,   color:"#FFD600", emoji:"🍭", discount:10 },
  { name:"Chocolat",  min:25,  max:49.99,   color:"#CD7F32", emoji:"🍫", discount:15 },
  { name:"Candy VIP", min:50,  max:Infinity,color:"#FF3D7F", emoji:"👑", discount:20 },
];

const DEMO_CUSTOMERS = [
  { id:1001, name:"Sophie Martin", email:"sophie@email.com", phone:"06 12 34 56 78", cagnotte:8.50,  joinDate:"2024-01-15", purchases:12, totalSpent:170 },
  { id:1002, name:"Lucas Dupont",  email:"lucas@email.com",  phone:"07 98 76 54 32", cagnotte:2.25,  joinDate:"2024-03-20", purchases:4,  totalSpent:45  },
  { id:1003, name:"Emma Leroy",    email:"emma@email.com",   phone:"06 55 44 33 22", cagnotte:56.00, joinDate:"2023-11-01", purchases:38, totalSpent:1120},
];

const getTier  = c   => TIERS.find(t => c >= t.min && c <= t.max) || TIERS[0];
const genCode  = pfx => (pfx||"MUNCHY") + "-" + Math.random().toString(36).substring(2,8).toUpperCase();
const qrUrl    = (data,sz=160) => `https://api.qrserver.com/v1/create-qr-code/?size=${sz}x${sz}&data=${encodeURIComponent(data)}&format=png`;
const clientQr = id  => `MUNCHY-CLIENT-${id}`;
const today    = ()  => new Date().toISOString().split("T")[0];
const newId    = ()  => 1000 + Math.floor(Math.random() * 8999);
const fmt      = n   => Number(n).toFixed(2);

function loadCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const d = JSON.parse(raw); return d.length > 0 ? d : DEMO_CUSTOMERS; }
  } catch {}
  return DEMO_CUSTOMERS;
}
function saveCustomers(c) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onSuccess }) {
  const [pwd, setPwd]     = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function handleLogin() {
    if (pwd === APP_PASSWORD) { sessionStorage.setItem("munchys-auth","1"); onSuccess(); }
    else {
      setError(true); setShake(true); setPwd("");
      setTimeout(() => { setShake(false); setError(false); }, 2000);
    }
  }

  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Georgia',serif" }}>
      <div style={{ textAlign:"center", padding:"32px 24px", maxWidth:"360px", width:"100%" }}>
        <div style={{ fontSize:"72px", marginBottom:"8px" }}>🍬</div>
        <div style={{ fontSize:"26px", fontWeight:"bold", letterSpacing:"3px", color:C.text, marginBottom:"4px" }}>MUNCHYS CANDY</div>
        <div style={{ fontSize:"12px", color:C.muted, marginBottom:"36px", letterSpacing:"1px" }}>Programme de Fidélité</div>
        <div style={{ background:C.card, borderRadius:"20px", padding:"28px 24px", border:"1px solid #ffffff15", transform:shake?"translateX(-8px)":"none", transition:"transform 0.1s" }}>
          <div style={{ fontSize:"14px", color:C.muted, marginBottom:"16px" }}>🔐 Accès réservé</div>
          <input type="password" placeholder="Mot de passe" value={pwd}
            onChange={e=>{setPwd(e.target.value);setError(false);}}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            style={{ background:C.cardLight, border:`1px solid ${error?C.pink:"#ffffff20"}`, borderRadius:"12px", padding:"14px 16px", color:C.text, fontSize:"16px", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center", letterSpacing:"4px", marginBottom:"12px" }}
            autoFocus />
          {error && <div style={{ color:C.pink, fontSize:"13px", marginBottom:"12px" }}>❌ Mot de passe incorrect</div>}
          <button onClick={handleLogin} style={{ background:`linear-gradient(135deg,${C.pink},${C.purple})`, border:"none", borderRadius:"12px", padding:"14px", color:"#fff", fontWeight:"bold", cursor:"pointer", fontSize:"15px", width:"100%", letterSpacing:"1px" }}>
            Entrer 🍭
          </button>
        </div>
        <div style={{ fontSize:"11px", color:"#ffffff22", marginTop:"24px" }}>munchys-candy.vercel.app</div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function MunchysLoyalty() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem("munchys-auth")==="1");
  if (!auth) return <LoginScreen onSuccess={()=>setAuth(true)} />;
  return <MainApp />;
}

function MainApp() {
  const [customers,     setCustomersRaw]  = useState(()=>loadCustomers());
  const [saveStatus,    setSaveStatus]    = useState("saved");
  const [tab,           setTab]           = useState("dashboard");
  const [expandedId,    setExpandedId]    = useState(null);
  const [selected,      setSelected]      = useState(null);
  const [purchaseAmt,   setPurchaseAmt]   = useState("");
  const [purchaseMsg,   setPurchaseMsg]   = useState(null);
  const [newCust,       setNewCust]       = useState({name:"",email:"",phone:""});
  const [addMsg,        setAddMsg]        = useState(null);
  const [cartAmt,       setCartAmt]       = useState("");
  const [diceResult,    setDiceResult]    = useState(null);
  const [diceRolling,   setDiceRolling]   = useState(false);
  const [diceWon,       setDiceWon]       = useState(false);
  const [promoCode,     setPromoCode]     = useState(null);
  const [emailTpl,      setEmailTpl]      = useState(null);
  const [groupEmailTpl, setGroupEmailTpl] = useState(null);
  const [scanActive,    setScanActive]    = useState(false);
  const [scanResult,    setScanResult]    = useState(null);
  const [scanError,     setScanError]     = useState(null);
  const [scanLoading,   setScanLoading]   = useState(false);
  const [jsqrReady,     setJsqrReady]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [copiedId,      setCopiedId]      = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);

  function setCustomers(updater) {
    setCustomersRaw(prev => {
      const next = typeof updater==="function" ? updater(prev) : updater;
      setSaveStatus("saving");
      saveCustomers(next);
      setTimeout(()=>setSaveStatus("saved"),600);
      return next;
    });
  }

  function logout() { sessionStorage.removeItem("munchys-auth"); window.location.reload(); }

  useEffect(()=>{
    if (window.jsQR){setJsqrReady(true);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js";
    s.onload=()=>setJsqrReady(true);
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{ if(tab!=="scanner") stopScanner(); },[tab]);

  function stopScanner() {
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    streamRef.current=null; setScanActive(false);
  }

  const scanFrame = useCallback(()=>{
    const video=videoRef.current, canvas=canvasRef.current;
    if(!video||!canvas||!window.jsQR) return;
    const ctx=canvas.getContext("2d");
    if(video.readyState===video.HAVE_ENOUGH_DATA){
      canvas.width=video.videoWidth; canvas.height=video.videoHeight;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const img=ctx.getImageData(0,0,canvas.width,canvas.height);
      const code=window.jsQR(img.data,img.width,img.height,{inversionAttempts:"dontInvert"});
      if(code?.data?.startsWith("MUNCHY-CLIENT-")){
        const id=parseInt(code.data.replace("MUNCHY-CLIENT-",""),10);
        const found=customers.find(c=>c.id===id);
        setScanResult(found?{type:"found",customer:found}:{type:"unknown"});
        setSelected(found||null);
        stopScanner(); return;
      }
    }
    rafRef.current=requestAnimationFrame(scanFrame);
  },[customers]);

  async function startScanner(){
    setScanError(null);setScanResult(null);setScanLoading(true);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setScanActive(true);setScanLoading(false);
      rafRef.current=requestAnimationFrame(scanFrame);
    }catch{
      setScanLoading(false);
      setScanError("Accès caméra refusé. Autorise la caméra dans ton navigateur.");
    }
  }

  function addPurchase(){
    const amount=parseFloat(purchaseAmt);
    if(!selected) return setPurchaseMsg({type:"error",text:"Sélectionne un client."});
    if(isNaN(amount)||amount<MIN_PURCHASE) return setPurchaseMsg({type:"error",text:`Minimum ${MIN_PURCHASE}€.`});
    const earned=parseFloat((amount*CASHBACK_RATE).toFixed(2));
    const updated={...selected, cagnotte:parseFloat((selected.cagnotte+earned).toFixed(2)), purchases:selected.purchases+1, totalSpent:parseFloat(((selected.totalSpent||0)+amount).toFixed(2))};
    setCustomers(prev=>prev.map(c=>c.id===selected.id?updated:c));
    setSelected(updated);
    setPurchaseMsg({type:"success",text:`✅ +${fmt(earned)}€ en cagnotte pour un achat de ${fmt(amount)}€ !`});
    setPurchaseAmt("");
    setTimeout(()=>setPurchaseMsg(null),4000);
  }

  function rollDice(){
    if(diceRolling) return;
    setDiceRolling(true);setDiceResult(null);setDiceWon(false);
    let count=0,r=1;
    const iv=setInterval(()=>{
      r=Math.floor(Math.random()*6)+1;setDiceResult(r);count++;
      if(count>=14){clearInterval(iv);setDiceRolling(false);if(r===6)setDiceWon(true);}
    },80);
  }

  function addCustomer(){
    if(!newCust.name||!newCust.email) return setAddMsg({type:"error",text:"Nom et email obligatoires."});
    if(customers.some(c=>c.email.toLowerCase()===newCust.email.toLowerCase()))
      return setAddMsg({type:"error",text:"Cet email existe déjà."});
    const c={id:newId(),name:newCust.name.trim(),email:newCust.email.trim(),phone:newCust.phone.trim(),cagnotte:0,joinDate:today(),purchases:0,totalSpent:0};
    setCustomers(prev=>[...prev,c]);
    setNewCust({name:"",email:"",phone:""});
    setAddMsg({type:"success",text:"Client ajouté ! Son QR code est prêt. 🎉"});
    setTimeout(()=>setAddMsg(null),4000);
  }

  function deleteCustomer(id){
    setCustomers(prev=>prev.filter(c=>c.id!==id));
    if(selected?.id===id) setSelected(null);
    setExpandedId(null);setDeleteConfirm(null);
  }

  // Emails individuels
  function generateEmail(type,customer){
    const c=customer||selected; if(!c) return;
    const tier=getTier(c.cagnotte), first=c.name.split(" ")[0], code=genCode("CANDY");
    const tpls={
      welcome:  {subject:`Bienvenue chez Munchys Candy, ${first} ! 🍬`, body:`Bonjour ${first},\n\nMerci d'avoir rejoint le programme de fidélité Munchys Candy ! 🎉\n\nChaque achat te rapporte 5% en cagnotte.\nTa cagnotte actuelle : ${fmt(c.cagnotte)}€\n\nCode de bienvenue : ${code}\n✅ -5% sur ta prochaine commande\n\nÀ très bientôt ! 🍭\n\nL'équipe Munchys Candy`},
      promo:    {subject:`Un cadeau spécial pour toi, ${first} ! 🎁`, body:`Bonjour ${first},\n\nTu es un(e) client(e) ${tier.emoji} ${tier.name} !\n\nCode promo exclusif : ${code}\n✅ -${tier.discount}% sur tous les bonbons\n⏳ Valable 30 jours\n\nL'équipe Munchys Candy`},
      birthday: {subject:`Joyeux anniversaire de Munchys ! 🎂`, body:`Bonjour ${first},\n\nToute l'équipe te souhaite un joyeux anniversaire ! 🎉\n\nCode anniversaire : ${code}\n🎁 -15% sur toute ta commande\n⏳ Valable jusqu'à la fin du mois\n\nBisous sucrés,\nL'équipe Munchys Candy`},
      offre5:   {subject:`🍬 Offre spéciale -5% chez Munchys Candy !`, body:`Bonjour ${first},\n\nUne offre rien que pour toi ! 🎁\n\nCode promo : ${code}\n✅ -5% sur toute la boutique\n⏳ Offre valable cette semaine seulement !\n\nViens vite profiter de tes bonbons préférés 🍭\n\nL'équipe Munchys Candy`},
      offre10:  {subject:`🍭 -10% chez Munchys Candy, rien que pour toi !`, body:`Bonjour ${first},\n\nOn a pensé à toi avec une super offre ! 🎉\n\nCode promo : ${code}\n✅ -10% sur toute la boutique\n⏳ Valable jusqu'à dimanche !\n\nOn t'attend avec plein de douceurs 🍫\n\nL'équipe Munchys Candy`},
      offre15:  {subject:`👑 Offre VIP -15% chez Munchys Candy !`, body:`Bonjour ${first},\n\nTu fais partie de nos clients privilégiés, alors voilà une offre VIP ! 👑\n\nCode promo : ${code}\n✅ -15% sur toute la boutique\n⏳ Offre exclusive — valable 15 jours\n\nMerci pour ta fidélité 🍬\n\nL'équipe Munchys Candy`},
    };
    setEmailTpl(tpls[type]);
  }

  // Emails groupés
  function generateGroupEmail(type){
    const code=genCode("CANDY");
    const tpls={
      welcome:  {subject:`Bienvenue chez Munchys Candy ! 🍬`, body:(name)=>`Bonjour ${name},\n\nMerci d'avoir rejoint notre programme de fidélité ! Chaque achat te rapporte 5% en cagnotte.\n\nCode de bienvenue : ${code}\n✅ -5% sur ta prochaine commande\n\nÀ très bientôt ! 🍭\n\nL'équipe Munchys Candy`},
      offre5:   {subject:`🍬 Offre spéciale -5% chez Munchys Candy !`, body:(name)=>`Bonjour ${name},\n\nUne offre spéciale rien que pour toi !\n\nCode promo : ${code}\n✅ -5% sur toute la boutique\n⏳ Valable cette semaine seulement !\n\nL'équipe Munchys Candy`},
      offre10:  {subject:`🍭 -10% chez Munchys Candy !`, body:(name)=>`Bonjour ${name},\n\nOn a une super offre pour toi !\n\nCode promo : ${code}\n✅ -10% sur toute la boutique\n⏳ Valable jusqu'à dimanche !\n\nL'équipe Munchys Candy`},
      offre15:  {subject:`👑 Offre VIP -15% chez Munchys Candy !`, body:(name)=>`Bonjour ${name},\n\nVoilà une offre exclusive pour nos clients fidèles !\n\nCode promo : ${code}\n✅ -15% sur toute la boutique\n⏳ Valable 15 jours\n\nMerci pour ta fidélité ! 🍬\n\nL'équipe Munchys Candy`},
      promo:    {subject:`Un cadeau spécial vous attend ! 🎁`, body:(name,tier)=>`Bonjour ${name},\n\nTu es client(e) ${tier.emoji} ${tier.name} — voici ta récompense !\n\nCode promo : ${genCode("CANDY")}\n✅ -${tier.discount}% sur tous les bonbons\n⏳ Valable 30 jours\n\nL'équipe Munchys Candy`},
    };
    setGroupEmailTpl({...tpls[type], type});
  }

  // Recherche clients
  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone||"").replace(/\s/g,"").includes(q.replace(/\s/g,""));
  });

  function copyEmail(text, id){
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(()=>setCopiedId(null),2000);
  }

  const S = {
    app:    {background:C.bg,minHeight:"100vh",fontFamily:"'Georgia',serif",color:C.text,paddingBottom:"50px"},
    header: {background:"linear-gradient(135deg,#FF3D7F,#9B51E0 50%,#00C2FF)",padding:"20px 24px",display:"flex",alignItems:"center",gap:"14px"},
    tabs:   {display:"flex",gap:"2px",padding:"14px 18px 0",borderBottom:"1px solid #ffffff15",background:C.card,flexWrap:"wrap"},
    tab: a  => ({padding:"9px 13px",borderRadius:"8px 8px 0 0",cursor:"pointer",fontSize:"12px",fontWeight:a?"bold":"normal",background:a?C.bg:"transparent",color:a?C.pink:C.muted,border:"none",transition:"all .2s"}),
    body:   {padding:"18px"},
    sec:    {background:C.card,borderRadius:"16px",padding:"18px",marginBottom:"16px",border:"1px solid #ffffff10"},
    stitle: {fontSize:"14px",fontWeight:"bold",marginBottom:"12px",color:C.yellow},
    input:  {background:C.cardLight,border:"1px solid #ffffff20",borderRadius:"10px",padding:"10px 14px",color:C.text,fontSize:"14px",outline:"none",width:"100%",boxSizing:"border-box"},
    btn: c  => ({background:c||C.pink,border:"none",borderRadius:"10px",padding:"10px 18px",color:"#fff",fontWeight:"bold",cursor:"pointer",fontSize:"13px"}),
    badge:c => ({background:c+"33",color:c,border:`1px solid ${c}66`,borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:"bold",display:"inline-block"}),
    msg: t  => ({padding:"10px 14px",borderRadius:"10px",fontSize:"13px",marginTop:"10px",background:t==="success"?"#00E67622":"#FF3D7F22",border:`1px solid ${t==="success"?C.green:C.pink}44`,color:t==="success"?C.green:C.pink}),
    row: s  => ({display:"flex",alignItems:"center",gap:"10px",padding:"11px",borderRadius:"12px",cursor:"pointer",background:s?"#FF3D7F22":"transparent",border:s?"1px solid #FF3D7F44":"1px solid transparent",transition:"all .2s",marginBottom:"6px"}),
    loyCard:c => ({background:`linear-gradient(135deg,${c}44,${c}11)`,border:`2px solid ${c}88`,borderRadius:"20px",padding:"20px",marginBottom:"10px",marginTop:"-4px"}),
    stat:c  => ({background:`linear-gradient(135deg,${c}22,${c}05)`,border:`1px solid ${c}44`,borderRadius:"14px",padding:"16px"}),
  };

  const totalCagnotte = customers.reduce((a,c)=>a+c.cagnotte,0);
  const totalSpent    = customers.reduce((a,c)=>a+(c.totalSpent||0),0);
  const topClient     = [...customers].sort((a,b)=>b.cagnotte-a.cagnotte)[0];

  const CustomerPicker = ({onPick,current}) => (
    <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
      {customers.map(c=>{
        const tier=getTier(c.cagnotte),sel=current?.id===c.id;
        return <div key={c.id} onClick={()=>onPick(c)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",borderRadius:"10px",cursor:"pointer",background:sel?"#FF3D7F22":"transparent",border:sel?`1px solid ${tier.color}`:"1px solid #ffffff20",transition:"all .2s"}}>
          <span>{tier.emoji}</span><span style={{fontSize:"13px"}}>{c.name}</span><span style={{fontSize:"11px",color:tier.color}}>{fmt(c.cagnotte)}€</span>
        </div>;
      })}
    </div>
  );

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div style={{fontSize:"34px"}}>🍬</div>
        <div style={{flex:1}}>
          <div style={{fontSize:"22px",fontWeight:"bold",letterSpacing:"2px"}}>MUNCHYS CANDY</div>
          <div style={{fontSize:"11px",opacity:.8}}>Programme de Fidélité — 5% en cagnotte</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px"}}>
          <div style={{fontSize:"11px",padding:"4px 10px",borderRadius:"20px",background:saveStatus==="saved"?"#00E67622":"#FFD60022",color:saveStatus==="saved"?C.green:C.yellow,border:`1px solid ${saveStatus==="saved"?C.green:C.yellow}44`}}>
            {saveStatus==="saved"?"✅ Sauvegardé":"⏳ Sauvegarde..."}
          </div>
          <button onClick={logout} style={{fontSize:"10px",background:"#ffffff15",border:"none",borderRadius:"20px",padding:"3px 10px",color:"#fff8",cursor:"pointer"}}>🔒 Déconnexion</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[["dashboard","📊 Dashboard"],["clients","👥 Clients"],["scanner","📷 Scanner QR"],["achat","💰 Achat"],["de","🎲 Dé"],["emails","📧 Emails"]].map(([id,lbl])=>(
          <button key={id} style={S.tab(tab===id)} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={S.body}>

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard" && <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:"12px",marginBottom:"18px"}}>
            {[[C.pink,"Total Clients",customers.length,"inscrits"],[C.yellow,"Cagnottes Totales",fmt(totalCagnotte)+"€","distribuées"],[C.blue,"Top Client",topClient?.name.split(" ")[0]||"-",fmt(topClient?.cagnotte||0)+"€"],[C.purple,"Taux Cagnotte","5%","de chaque achat"]].map(([c,l,v,s])=>(
              <div key={l} style={S.stat(c)}>
                <div style={{fontSize:"10px",color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>{l}</div>
                <div style={{fontSize:"24px",fontWeight:"bold",color:c,margin:"4px 0"}}>{v}</div>
                <div style={{fontSize:"11px",color:C.muted}}>{s}</div>
              </div>
            ))}
          </div>
          <div style={S.sec}>
            <div style={S.stitle}>🏆 Niveaux de Fidélité</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"8px"}}>
              {TIERS.map(tier=>{
                const n=customers.filter(c=>c.cagnotte>=tier.min&&c.cagnotte<=tier.max).length;
                return <div key={tier.name} style={{background:tier.color+"15",border:`1px solid ${tier.color}44`,borderRadius:"12px",padding:"12px",textAlign:"center"}}>
                  <div style={{fontSize:"22px"}}>{tier.emoji}</div>
                  <div style={{fontWeight:"bold",color:tier.color,fontSize:"12px"}}>{tier.name}</div>
                  <div style={{fontSize:"10px",color:C.muted,margin:"2px 0"}}>{tier.min}€–{tier.max===Infinity?"∞":tier.max+"€"}</div>
                  <div style={{fontSize:"16px",fontWeight:"bold"}}>{n} <span style={{fontSize:"10px",color:C.muted}}>clients</span></div>
                  <div style={{fontSize:"11px",color:tier.color}}>-{tier.discount}%</div>
                </div>;
              })}
            </div>
          </div>
          <div style={{...S.sec,background:"#FFD60008",border:"1px solid #FFD60033"}}>
            <div style={S.stitle}>💰 Comment fonctionne la Cagnotte ?</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"8px"}}>
              {[[1,0.05],[5,0.25],[10,0.50],[20,1.00],[50,2.50],[100,5.00]].map(([spent,earned])=>(
                <div key={spent} style={{background:C.cardLight,borderRadius:"10px",padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:"14px",fontWeight:"bold",color:C.yellow}}>{spent}€ dépensé</div>
                  <div style={{fontSize:"10px",color:C.muted}}>→ 5%</div>
                  <div style={{fontSize:"14px",fontWeight:"bold",color:C.green}}>+{fmt(earned)}€ cagnotte</div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ═══ CLIENTS ═══ */}
        {tab==="clients" && <>
          <div style={S.sec}>
            <div style={S.stitle}>➕ Ajouter un client</div>
            <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
              <input style={{...S.input,flex:1,minWidth:"140px"}} placeholder="Nom complet *" value={newCust.name} onChange={e=>setNewCust(p=>({...p,name:e.target.value}))} />
              <input style={{...S.input,flex:1,minWidth:"160px"}} placeholder="Email *" value={newCust.email} onChange={e=>setNewCust(p=>({...p,email:e.target.value}))} />
              <input style={{...S.input,flex:1,minWidth:"130px"}} placeholder="Téléphone" value={newCust.phone} onChange={e=>setNewCust(p=>({...p,phone:e.target.value}))} />
              <button style={S.btn(C.green)} onClick={addCustomer}>Ajouter</button>
            </div>
            {addMsg && <div style={S.msg(addMsg.type)}>{addMsg.text}</div>}
          </div>

          {/* Barre de recherche */}
          <div style={{...S.sec,padding:"12px 18px"}}>
            <input style={{...S.input}} placeholder="🔍 Rechercher par nom, email ou téléphone..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            {searchQuery && <div style={{fontSize:"12px",color:C.muted,marginTop:"6px"}}>{filteredCustomers.length} résultat(s) pour "{searchQuery}"</div>}
          </div>

          {filteredCustomers.length===0 && <div style={{textAlign:"center",color:C.muted,padding:"30px"}}>Aucun client trouvé 🔍</div>}

          {filteredCustomers.map(c=>{
            const tier=getTier(c.cagnotte), next=TIERS[TIERS.indexOf(tier)+1];
            const pct=next?((c.cagnotte-tier.min)/(next.min-tier.min))*100:100;
            const open=expandedId===c.id;
            return <div key={c.id}>
              <div style={S.row(open)} onClick={()=>setExpandedId(open?null:c.id)}>
                <div style={{width:"38px",height:"38px",borderRadius:"50%",background:tier.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>{tier.emoji}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:"bold",fontSize:"13px"}}>{c.name}</div>
                  <div style={{fontSize:"10px",color:C.muted}}>{c.email}{c.phone?" · "+c.phone:""} · {c.purchases} achats</div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"4px"}}>
                    <div style={{flex:1,background:"#ffffff15",borderRadius:"4px",height:"4px"}}>
                      <div style={{height:"4px",borderRadius:"4px",background:`linear-gradient(90deg,${tier.color},${tier.color}88)`,width:`${Math.min(pct,100)}%`,transition:"width .5s"}} />
                    </div>
                    {next&&<div style={{fontSize:"9px",color:C.muted,flexShrink:0}}>{fmt(next.min-c.cagnotte)}€→{next.emoji}</div>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginRight:"4px"}}>
                  <div style={{fontWeight:"bold",color:tier.color,fontSize:"14px"}}>{fmt(c.cagnotte)}€</div>
                  <span style={S.badge(tier.color)}>{tier.name}</span>
                </div>
                <div style={{fontSize:"11px",color:C.muted}}>{open?"▲":"▼"}</div>
              </div>
              {open && <div style={S.loyCard(tier.color)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"14px",flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"9px",color:tier.color,letterSpacing:"2px",textTransform:"uppercase"}}>Munchys Candy — Carte de Fidélité</div>
                    <div style={{fontSize:"18px",fontWeight:"bold",marginTop:"6px"}}>{c.name}</div>
                    <div style={{fontSize:"10px",color:C.muted}}>{c.email}{c.phone?" · "+c.phone:""}</div>
                    <div style={{fontSize:"10px",color:C.muted}}>Membre depuis {c.joinDate}</div>
                    <div style={{display:"flex",gap:"16px",marginTop:"12px",flexWrap:"wrap"}}>
                      {[["CAGNOTTE",fmt(c.cagnotte)+"€",tier.color],["ACHATS",c.purchases,C.text],["REMISE",`-${tier.discount}%`,C.green]].map(([l,v,col])=>(
                        <div key={l}><div style={{fontSize:"8px",color:C.muted,letterSpacing:"1px"}}>{l}</div><div style={{fontSize:"22px",fontWeight:"bold",color:col}}>{v}</div></div>
                      ))}
                    </div>
                    <div style={{marginTop:"10px",fontSize:"9px",color:C.muted,letterSpacing:"2px"}}>#{String(c.id).padStart(6,"0")} · MUNCHYS CANDY CLUB</div>
                    <div style={{display:"flex",gap:"8px",marginTop:"14px",flexWrap:"wrap"}}>
                      <button style={{...S.btn(C.green),fontSize:"11px",padding:"7px 12px"}} onClick={()=>{setSelected(c);setTab("achat");}}>💰 Achat</button>
                      <button style={{...S.btn(C.purple),fontSize:"11px",padding:"7px 12px"}} onClick={()=>{setSelected(c);setTab("emails");}}>📧 Email</button>
                      {deleteConfirm===c.id
                        ?<><button style={{...S.btn("#ff4444"),fontSize:"11px",padding:"7px 12px"}} onClick={()=>deleteCustomer(c.id)}>Confirmer ✕</button>
                           <button style={{...S.btn(C.muted),fontSize:"11px",padding:"7px 12px"}} onClick={()=>setDeleteConfirm(null)}>Annuler</button></>
                        :<button style={{...S.btn(C.muted),fontSize:"11px",padding:"7px 12px"}} onClick={()=>setDeleteConfirm(c.id)}>🗑 Supprimer</button>
                      }
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                    <div style={{background:"#fff",padding:"7px",borderRadius:"10px",boxShadow:`0 0 16px ${tier.color}44`}}>
                      <img src={qrUrl(clientQr(c.id))} alt="QR" width={130} height={130} style={{display:"block",borderRadius:"6px"}} />
                    </div>
                    <div style={{fontSize:"9px",color:C.muted}}>Scanner pour identifier</div>
                    <span style={S.badge(tier.color)}>{tier.emoji} {tier.name}</span>
                  </div>
                </div>
              </div>}
            </div>;
          })}
        </>}

        {/* ═══ SCANNER ═══ */}
        {tab==="scanner" && <>
          <div style={S.sec}>
            <div style={S.stitle}>📷 Scanner la Carte Client</div>
            <p style={{color:C.muted,fontSize:"12px",marginTop:0}}>Le client montre son QR — tu scannes, son profil s'affiche.</p>
            {!scanActive&&!scanResult&&(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:"58px",marginBottom:"14px"}}>📷</div>
                <button style={{...S.btn(C.purple),fontSize:"15px",padding:"13px 32px"}} onClick={startScanner} disabled={!jsqrReady||scanLoading}>
                  {scanLoading?"⏳ Démarrage...":!jsqrReady?"⏳ Chargement...":"📷 Démarrer le scanner"}
                </button>
              </div>
            )}
            {scanError&&<div style={S.msg("error")}>{scanError}</div>}
            {scanActive&&<>
              <div style={{position:"relative",borderRadius:"14px",overflow:"hidden",background:"#000",maxWidth:"440px",margin:"0 auto"}}>
                <video ref={videoRef} style={{width:"100%",display:"block"}} playsInline muted />
                <canvas ref={canvasRef} style={{display:"none"}} />
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                  <div style={{width:"190px",height:"190px",border:"3px solid "+C.pink,borderRadius:"14px",boxShadow:"0 0 0 9999px rgba(0,0,0,0.5)"}} />
                </div>
                <div style={{position:"absolute",bottom:"12px",left:0,right:0,textAlign:"center"}}>
                  <div style={{background:"rgba(0,0,0,.75)",color:C.text,fontSize:"11px",padding:"5px 14px",borderRadius:"20px",display:"inline-block"}}>🔍 Placez le QR dans le cadre</div>
                </div>
              </div>
              <div style={{textAlign:"center",marginTop:"12px"}}><button style={S.btn(C.muted)} onClick={stopScanner}>✕ Annuler</button></div>
            </>}
            {scanResult&&(()=>{
              if(scanResult.type==="unknown") return <div style={S.msg("error")}>QR non reconnu.</div>;
              const c=customers.find(x=>x.id===scanResult.customer.id)||scanResult.customer, tier=getTier(c.cagnotte);
              return <div>
                <div style={{background:"#00E67622",border:`2px solid ${C.green}`,borderRadius:"14px",padding:"18px",marginBottom:"12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
                    <div style={{fontSize:"38px"}}>{tier.emoji}</div>
                    <div style={{flex:1}}><div style={{fontSize:"10px",color:C.green,letterSpacing:"1px"}}>✅ CLIENT IDENTIFIÉ</div><div style={{fontSize:"18px",fontWeight:"bold"}}>{c.name}</div><div style={{fontSize:"11px",color:C.muted}}>{c.email}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:"24px",fontWeight:"bold",color:tier.color}}>{fmt(c.cagnotte)}€</div><div style={{fontSize:"10px",color:C.muted}}>cagnotte</div></div>
                  </div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    <span style={S.badge(tier.color)}>{tier.emoji} {tier.name}</span>
                    <span style={S.badge(C.blue)}>-{tier.discount}%</span>
                    <span style={S.badge(C.muted)}>{c.purchases} achats</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <button style={S.btn(C.green)} onClick={()=>{setSelected(c);setTab("achat");}}>💰 Enregistrer un achat</button>
                  <button style={S.btn(C.purple)} onClick={()=>{setSelected(c);setTab("emails");}}>📧 Email</button>
                  <button style={S.btn(C.blue)} onClick={()=>{setScanResult(null);startScanner();}}>📷 Rescanner</button>
                </div>
              </div>;
            })()}
          </div>

          {/* Recherche manuelle */}
          <div style={S.sec}>
            <div style={S.stitle}>🔍 Recherche manuelle (sans QR)</div>
            <input style={S.input} placeholder="Rechercher par nom, email ou téléphone..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            {searchQuery && filteredCustomers.map(c=>{
              const tier=getTier(c.cagnotte);
              return <div key={c.id} style={{...S.row(selected?.id===c.id),marginTop:"8px"}} onClick={()=>{setSelected(c);setSearchQuery("");}}>
                <div style={{fontSize:"24px"}}>{tier.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:"bold",fontSize:"13px"}}>{c.name}</div>
                  <div style={{fontSize:"11px",color:C.muted}}>{c.email}{c.phone?" · "+c.phone:""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:"bold",color:tier.color}}>{fmt(c.cagnotte)}€</div>
                  <span style={S.badge(tier.color)}>{tier.name}</span>
                </div>
              </div>;
            })}
            {selected && !searchQuery && (
              <div style={{background:"#00E67622",border:`1px solid ${C.green}44`,borderRadius:"12px",padding:"12px",marginTop:"10px",display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"24px"}}>{getTier(selected.cagnotte).emoji}</span>
                <div style={{flex:1}}><div style={{fontWeight:"bold"}}>{selected.name}</div><div style={{fontSize:"11px",color:C.muted}}>{selected.email}</div></div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...S.btn(C.green),fontSize:"11px",padding:"7px 12px"}} onClick={()=>setTab("achat")}>💰 Achat</button>
                  <button style={{...S.btn(C.muted),fontSize:"11px",padding:"7px 12px"}} onClick={()=>setSelected(null)}>✕</button>
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ═══ ACHAT ═══ */}
        {tab==="achat" && <>
          <div style={S.sec}>
            <div style={S.stitle}>👤 Sélectionner un client</div>
            <p style={{color:C.muted,fontSize:"12px",marginTop:0}}>Ou utilise <button style={{background:"none",border:"none",color:C.purple,cursor:"pointer",fontWeight:"bold",fontSize:"12px",padding:0}} onClick={()=>setTab("scanner")}>📷 le scanner QR</button></p>
            <CustomerPicker onPick={setSelected} current={selected} />
          </div>
          {selected&&<div style={S.sec}>
            <div style={S.stitle}>💰 Enregistrer un achat — {selected.name}</div>
            <div style={{background:C.cardLight,borderRadius:"10px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px"}}>
              💡 Le client gagne <strong style={{color:C.green}}>5%</strong> du montant en cagnotte.
              Cagnotte actuelle : <strong style={{color:getTier(selected.cagnotte).color}}>{fmt(selected.cagnotte)}€</strong>
            </div>
            <div style={{display:"flex",gap:"10px"}}>
              <input style={{...S.input,flex:1}} type="number" placeholder="Montant de l'achat (€)" value={purchaseAmt} onChange={e=>setPurchaseAmt(e.target.value)} />
              <button style={S.btn(C.green)} onClick={addPurchase}>Valider</button>
            </div>
            {purchaseAmt&&parseFloat(purchaseAmt)>=MIN_PURCHASE&&(
              <div style={{fontSize:"12px",color:C.yellow,marginTop:"8px"}}>
                ✨ Cet achat rapportera <strong style={{color:C.green}}>+{fmt(parseFloat(purchaseAmt)*CASHBACK_RATE)}€</strong> en cagnotte
              </div>
            )}
            {purchaseMsg&&<div style={S.msg(purchaseMsg.type)}>{purchaseMsg.text}</div>}
          </div>}
          <div style={S.sec}>
            <div style={S.stitle}>📊 Simulateur — 5% en Cagnotte</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:"8px"}}>
              {[1,5,10,20,50,100].map(a=>(
                <div key={a} style={{background:C.cardLight,borderRadius:"10px",padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:"15px",fontWeight:"bold",color:C.yellow}}>{a}€</div>
                  <div style={{fontSize:"10px",color:C.muted}}>→ 5%</div>
                  <div style={{fontSize:"14px",fontWeight:"bold",color:C.green}}>{fmt(a*0.05)}€</div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ═══ DÉ ═══ */}
        {tab==="de"&&<div style={{...S.sec,textAlign:"center"}}>
          <div style={S.stitle}>🎲 Jeu du Dé — Panier Gratuit !</div>
          <p style={{color:C.muted,fontSize:"12px"}}>Un <strong style={{color:C.yellow}}>6</strong> = panier <strong style={{color:C.green}}>100% GRATUIT</strong> !</p>
          <div style={{display:"flex",justifyContent:"center",marginBottom:"14px"}}>
            <input style={{...S.input,width:"200px"}} placeholder="Montant du panier (€)" value={cartAmt} onChange={e=>setCartAmt(e.target.value)} />
          </div>
          <div style={{fontSize:"88px",cursor:"pointer",userSelect:"none",filter:diceRolling?"blur(1px)":"none"}} onClick={rollDice}>{diceResult?DICE_FACES[diceResult]:"🎲"}</div>
          <button style={{...S.btn(diceRolling?C.muted:C.purple),fontSize:"15px",padding:"12px 28px",margin:"10px 0"}} onClick={rollDice} disabled={diceRolling}>
            {diceRolling?"⏳ En cours...":"🎲 Lancer le dé !"}
          </button>
          {diceResult&&!diceRolling&&(diceWon
            ?<div style={{background:"#00E67622",border:`2px solid ${C.green}`,borderRadius:"14px",padding:"20px"}}>
                <div style={{fontSize:"40px"}}>🎉</div>
                <div style={{fontSize:"20px",fontWeight:"bold",color:C.green}}>FÉLICITATIONS !</div>
                {cartAmt&&<div style={{fontSize:"18px",fontWeight:"bold",color:C.green,marginTop:"6px"}}>🎁 {cartAmt}€ → GRATUIT !</div>}
              </div>
            :<div style={{background:"#FF3D7F11",border:"1px solid #FF3D7F44",borderRadius:"14px",padding:"16px"}}>
                <div style={{fontSize:"32px"}}>{DICE_FACES[diceResult]}</div>
                <div style={{fontSize:"15px",color:C.pink,fontWeight:"bold"}}>Résultat : {diceResult}</div>
                <div style={{fontSize:"11px",color:C.muted,marginTop:"5px"}}>Pas de 6 cette fois… à la prochaine ! 🍬</div>
              </div>
          )}
        </div>}

        {/* ═══ EMAILS ═══ */}
        {tab==="emails"&&<>
          {/* Onglets emails */}
          <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
            {[["individuel","👤 Email individuel"],["groupe","📢 Email groupé"]].map(([id,lbl])=>{
              const active = (id==="individuel" && !groupEmailTpl) || (id==="groupe" && !!groupEmailTpl);
              return <button key={id} style={{...S.btn(active?C.pink:C.cardLight),fontSize:"13px"}} onClick={()=>{if(id==="groupe")setGroupEmailTpl("pending");else setGroupEmailTpl(null);}}>
                {lbl}
              </button>;
            })}
          </div>

          {/* Email individuel */}
          {!groupEmailTpl && <>
            <div style={S.sec}>
              <div style={S.stitle}>👤 Sélectionner un client</div>
              <CustomerPicker onPick={setSelected} current={selected} />
            </div>
            {selected&&<>
              <div style={S.sec}>
                <div style={S.stitle}>📧 Templates d'Email</div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"8px"}}>
                  <button style={S.btn(C.blue)} onClick={()=>generateEmail("welcome")}>🎉 Bienvenue</button>
                  <button style={S.btn(C.purple)} onClick={()=>generateEmail("promo")}>🎁 Code Promo</button>
                  <button style={S.btn(C.pink)} onClick={()=>generateEmail("birthday")}>🎂 Anniversaire</button>
                </div>
                <div style={{borderTop:"1px solid #ffffff15",paddingTop:"10px",marginTop:"4px"}}>
                  <div style={{fontSize:"12px",color:C.yellow,marginBottom:"8px",fontWeight:"bold"}}>🏷 Offres du Moment</div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    <button style={S.btn("#22AA66")} onClick={()=>generateEmail("offre5")}>🍬 -5% Offre</button>
                    <button style={S.btn("#DD8800")} onClick={()=>generateEmail("offre10")}>🍭 -10% Offre</button>
                    <button style={S.btn(C.purple)} onClick={()=>generateEmail("offre15")}>👑 -15% Offre VIP</button>
                  </div>
                </div>
                {emailTpl&&<>
                  <div style={{fontWeight:"bold",fontSize:"12px",marginTop:"14px",color:C.yellow}}>📩 Objet : {emailTpl.subject}</div>
                  <div style={{background:C.cardLight,borderRadius:"10px",padding:"12px",fontSize:"12px",lineHeight:"1.8",whiteSpace:"pre-wrap",border:"1px solid #ffffff15",marginTop:"6px"}}>{emailTpl.body}</div>
                  <button style={{...S.btn(C.muted),marginTop:"8px",fontSize:"11px"}} onClick={()=>navigator.clipboard?.writeText(`Objet: ${emailTpl.subject}\n\n${emailTpl.body}`)}>📋 Copier</button>
                </>}
              </div>
              <div style={S.sec}>
                <div style={S.stitle}>🎟 Code Promo Personnalisé</div>
                <button style={S.btn(C.yellow)} onClick={()=>{const tier=getTier(selected.cagnotte);setPromoCode({code:genCode(),discount:tier.discount,tier:tier.name});}}>✨ Générer</button>
                {promoCode&&<div style={{marginTop:"12px",background:C.yellow+"15",border:`2px dashed ${C.yellow}`,borderRadius:"12px",padding:"16px",textAlign:"center"}}>
                  <div style={{fontSize:"10px",color:C.muted,letterSpacing:"2px"}}>CODE PROMO</div>
                  <div style={{fontSize:"24px",fontWeight:"bold",color:C.yellow,letterSpacing:"4px",margin:"6px 0"}}>{promoCode.code}</div>
                  <div style={{color:C.green,fontWeight:"bold",fontSize:"13px"}}>-{promoCode.discount}% · {promoCode.tier}</div>
                </div>}
              </div>
            </>}
            {!selected&&<div style={{textAlign:"center",color:C.muted,padding:"30px"}}>Sélectionne un client pour continuer</div>}
          </>}

          {/* Email groupé */}
          {groupEmailTpl && <>
            <div style={S.sec}>
              <div style={S.stitle}>📢 Choisir le template groupé</div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"8px"}}>
                <button style={S.btn(C.blue)} onClick={()=>generateGroupEmail("welcome")}>🎉 Bienvenue</button>
                <button style={S.btn(C.purple)} onClick={()=>generateGroupEmail("promo")}>🎁 Code Promo</button>
              </div>
              <div style={{borderTop:"1px solid #ffffff15",paddingTop:"10px",marginTop:"4px"}}>
                <div style={{fontSize:"12px",color:C.yellow,marginBottom:"8px",fontWeight:"bold"}}>🏷 Offres du Moment</div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <button style={S.btn("#22AA66")} onClick={()=>generateGroupEmail("offre5")}>🍬 -5% à tous</button>
                  <button style={S.btn("#DD8800")} onClick={()=>generateGroupEmail("offre10")}>🍭 -10% à tous</button>
                  <button style={S.btn(C.purple)} onClick={()=>generateGroupEmail("offre15")}>👑 -15% à tous</button>
                </div>
              </div>
            </div>

            {groupEmailTpl && groupEmailTpl !== "pending" && (
              <div style={S.sec}>
                <div style={S.stitle}>📬 Emails à envoyer — {customers.length} clients</div>
                <div style={{fontSize:"12px",color:C.muted,marginBottom:"12px"}}>
                  Copie chaque email et envoie-le depuis ta boîte mail (ou utilise Mailchimp/Brevo pour l'envoi automatique).
                </div>
                {customers.map(c=>{
                  const tier=getTier(c.cagnotte);
                  const body = typeof groupEmailTpl.body==="function" ? groupEmailTpl.body(c.name.split(" ")[0], tier) : groupEmailTpl.body;
                  const full = `Objet: ${groupEmailTpl.subject}\n\n${body}`;
                  return <div key={c.id} style={{background:C.cardLight,borderRadius:"12px",padding:"12px",marginBottom:"10px",border:"1px solid #ffffff10"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{fontSize:"18px"}}>{tier.emoji}</span>
                        <div>
                          <div style={{fontWeight:"bold",fontSize:"13px"}}>{c.name}</div>
                          <div style={{fontSize:"11px",color:C.muted}}>{c.email}</div>
                        </div>
                      </div>
                      <button style={{...S.btn(copiedId===c.id?C.green:C.purple),fontSize:"11px",padding:"6px 12px"}} onClick={()=>copyEmail(full,c.id)}>
                        {copiedId===c.id?"✅ Copié !":"📋 Copier"}
                      </button>
                    </div>
                    <div style={{fontSize:"11px",color:C.muted,background:C.bg,borderRadius:"8px",padding:"8px",lineHeight:"1.6",whiteSpace:"pre-wrap",maxHeight:"80px",overflow:"hidden"}}>
                      {body.substring(0,150)}...
                    </div>
                  </div>;
                })}
              </div>
            )}

            <div style={S.sec}>
              <div style={S.stitle}>📬 Envoi automatique recommandé</div>
              {[["📮 Mailchimp","Gratuit jusqu'à 500 contacts · Importe ta liste et envoie en 1 clic"],["📧 Brevo","300 emails/jour gratuits · Interface en français"],["🔁 Klaviyo","Spécialisé boutiques · Automatisations avancées"]].map(([n,d])=>(
                <div key={n} style={{background:C.cardLight,borderRadius:"10px",padding:"10px 12px",marginBottom:"7px"}}>
                  <div style={{fontWeight:"bold",fontSize:"12px"}}>{n}</div>
                  <div style={{fontSize:"11px",color:C.muted,marginTop:"1px"}}>{d}</div>
                </div>
              ))}
            </div>
          </>}
        </>}

      </div>
    </div>
  );
}
