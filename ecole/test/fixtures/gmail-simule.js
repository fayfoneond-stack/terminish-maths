'use strict';
/** Préchargé UNIQUEMENT par le sous-processus du test HTTP : pas de connexion Gmail. */
const Module = require('node:module');
const fs = require('node:fs');
const original = Module._load;
Module._load = function (requete, parent, isMain) {
  if (requete === 'nodemailer') return {
    createTransport: () => ({
      sendMail: async message => {
        fs.appendFileSync(process.env.TEST_MAIL_CAPTURE, JSON.stringify({
          destinataire: message.to, texte: message.text
        }) + '\n', { mode: 0o600 });
        return { accepted: [message.to] };
      }
    })
  };
  return original.call(this, requete, parent, isMain);
};
