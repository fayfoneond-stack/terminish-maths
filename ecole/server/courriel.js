'use strict';
/** Gmail SMTP TLS : les identifiants restent uniquement dans l'environnement du serveur. */
const nodemailer = require('nodemailer');
const { normaliserEmail } = require('./recuperation');

function configuration(env = process.env) {
  const email = normaliserEmail(env.GMAIL_USER);
  const secret = typeof env.GMAIL_APP_PASSWORD === 'string' ? env.GMAIL_APP_PASSWORD.trim() : '';
  let adresse = null;
  try {
    const saisie = String(env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
    const url = new URL(saisie);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && env.NODE_ENV !== 'production';
    if ((url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
        !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' &&
        saisie === url.origin) adresse = url.origin;
  } catch (_) { /* pas de lien public fiable : ne pas envoyer de courriel */ }
  if (!email || !secret || !adresse) return { actif: false };
  return {
    actif: true, publicUrl: adresse, email,
    smtp: {
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: email, pass: secret },
      tls: { minVersion: 'TLSv1.2', servername: 'smtp.gmail.com' },
      connectionTimeout: 12_000, greetingTimeout: 12_000, socketTimeout: 15_000
    }
  };
}

function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function envoyerLien({ email, lien, minutes }, config = configuration(), transport) {
  if (!config.actif) throw new Error('Envoi Gmail non configuré');
  const texte = `Bonjour,\n\nUne demande de réinitialisation du mot de passe de votre compte Terminish École a été reçue.\n\nOuvrez ce lien pour choisir un nouveau mot de passe (valable ${minutes} minutes, une seule utilisation) :\n${lien}\n\nSi vous n'avez pas fait cette demande, ignorez ce message : votre mot de passe ne change pas.\n\nTerminish École`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#193e31;line-height:1.6">
    <h2 style="color:#0b6b4a">Terminish École</h2>
    <p>Une demande de réinitialisation de votre mot de passe a été reçue.</p>
    <p><a href="${echapper(lien)}" style="display:inline-block;background:#0b6b4a;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
    <p>Ce lien est valable ${minutes} minutes et ne fonctionne qu'une fois.</p>
    <p>Si vous n'avez pas fait cette demande, ignorez ce message : votre mot de passe ne change pas.</p>
    <p style="color:#607a6e;font-size:12px">Si le bouton ne s'ouvre pas, copiez cette adresse dans votre navigateur :<br>${echapper(lien)}</p>
  </div>`;
  const smtp = transport || nodemailer.createTransport(config.smtp);
  return smtp.sendMail({
    from: { name: 'Terminish École', address: config.email }, to: email,
    subject: 'Terminish École — réinitialiser votre mot de passe', text: texte, html,
    disableFileAccess: true, disableUrlAccess: true
  });
}

module.exports = { configuration, envoyerLien };
