// Ce fichier s'exécute automatiquement chaque matin à 9h
// Il vérifie les anniversaires et envoie les emails automatiquement

const SUPABASE_URL = "https://swrpladhwaspibpoegwn.supabase.co";
const SUPABASE_KEY = "sb_publishable_1m5yOZvVzFfXQQYqoN8h_A_nd56vaPI";

function genCode() {
  return "BIRTHDAY-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default async function handler(req, res) {
  // Sécurité — vérifie que c'est bien Vercel qui appelle
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  const today = new Date();
  const todayMonth = today.getMonth() + 1; // 1-12
  const todayDay   = today.getDate();

  try {
    // Récupère tous les clients depuis Supabase
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const customers = await r.json();

    if (!Array.isArray(customers)) {
      return res.status(500).json({ error: "Erreur Supabase" });
    }

    // Filtre les clients dont c'est l'anniversaire aujourd'hui
    const birthdayClients = customers.filter(c => {
      if (!c.birthday) return false;
      const d = new Date(c.birthday);
      return (d.getMonth() + 1) === todayMonth && d.getDate() === todayDay;
    });

    console.log(`🎂 ${birthdayClients.length} anniversaire(s) aujourd'hui`);

    const results = [];

    for (const client of birthdayClients) {
      const code    = genCode();
      const first   = client.name.split(" ")[0];
      const cagnotte = parseFloat(client.cagnotte || 0).toFixed(2);

      // Calcule le niveau
      let tier = "🍬 Sucre";
      if (client.cagnotte >= 50) tier = "👑 Candy VIP";
      else if (client.cagnotte >= 25) tier = "🍫 Chocolat";
      else if (client.cagnotte >= 10) tier = "🍭 Caramel";

      const subject = `🎂 Joyeux anniversaire ${first} ! Un cadeau t'attend chez Munchy's Candy`;
      const body = `Bonjour ${first},\n\nToute l'équipe Munchy's Candy te souhaite un joyeux anniversaire ! 🎉🎂\n\nPour fêter ton grand jour, voici un cadeau spécial :\n\nCode anniversaire : ${code}\n🎁 -15% sur toute ta commande\n⏳ Valable jusqu'à la fin du mois\n\nTa cagnotte actuelle : ${cagnotte}€ · Niveau ${tier}\n\nOn t'attend avec plein de douceurs ! 🍬🍭🍫\n\nBisous sucrés,\nL'équipe Munchy's Candy`;

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`MUNCHY-CLIENT-${client.id}`)}&format=png&bgcolor=16162A&color=FFFFFF`;

      // Envoie l'email via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Munchy's Candy <contact@munchyscandy.fr>",
          to: [client.email],
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D0D1A; color: #ffffff; padding: 0; border-radius: 16px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #FF3D7F, #9B51E0 50%, #00C2FF); padding: 28px; text-align: center;">
                <div style="font-size: 56px;">🎂</div>
                <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: white; margin-top: 4px;">JOYEUX ANNIVERSAIRE !</div>
                <div style="font-size: 14px; color: rgba(255,255,255,0.9); margin-top: 4px;">Munchy's Candy</div>
              </div>
              <div style="padding: 28px; background: #16162A; font-size: 14px; line-height: 1.8; color: #E0E0E0;">
                ${body.replace(/\n/g, "<br>")}
              </div>
              <div style="text-align: center; padding: 24px; background: #1E1E35; border-radius: 12px; margin: 0 20px 20px;">
                <div style="font-size: 14px; color: #FFD600; font-weight: bold; margin-bottom: 12px;">🎴 TA CARTE DE FIDÉLITÉ</div>
                <div style="background: white; padding: 10px; border-radius: 12px; display: inline-block;">
                  <img src="${qrCodeUrl}" alt="QR Code" width="160" height="160" style="display: block; border-radius: 8px;" />
                </div>
                <div style="font-size: 11px; color: #8888AA; margin-top: 8px;">Montre ce QR code en boutique</div>
              </div>
              <div style="padding: 20px; background: #0D0D1A; text-align: center; font-size: 11px; color: #8888AA; border-top: 1px solid #ffffff10;">
                Munchy's Candy · contact@munchyscandy.fr · Société Kalice · BE 0750.497.413
              </div>
            </div>
          `,
        }),
      });

      const emailData = await emailRes.json();
      results.push({ client: client.name, email: client.email, success: emailRes.ok, id: emailData.id });
      console.log(`✅ Email envoyé à ${client.name} (${client.email})`);
    }

    return res.status(200).json({
      date: today.toISOString().split("T")[0],
      birthdaysFound: birthdayClients.length,
      emailsSent: results.filter(r => r.success).length,
      results,
    });

  } catch (error) {
    console.error("Erreur cron anniversaire:", error);
    return res.status(500).json({ error: error.message });
  }
}
