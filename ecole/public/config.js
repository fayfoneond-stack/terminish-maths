/* =========================================================================
   Terminish École — configuration de l'interface (facultatif)
   -------------------------------------------------------------------------
   Ce fichier ne sert QUE si l'interface est publiée séparément de l'API
   (par exemple sur Firebase Hosting) tandis que le serveur tourne ailleurs.

   Cas normal (site complet servi par Node, y compris avec Tailscale Funnel) :
     window.TERMINISH_API_BASE = '';

   Interface sur Firebase Hosting + API sur Tailscale :
     window.TERMINISH_API_BASE = 'https://penguin.tail7710c8.ts.net';

   ⚠ Dans ce cas, sur le serveur :
       CORS_ORIGIN=https://votre-projet.web.app
       COOKIE_SECURE=1
   et le navigateur exigera HTTPS des deux côtés.
   ========================================================================= */
window.TERMINISH_API_BASE = window.TERMINISH_API_BASE || '';
