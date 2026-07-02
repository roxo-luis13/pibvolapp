// ===== ESTADO GLOBAL =====
// ===== ESTADO =====
const ICONES = {'ti-music':'🎵','ti-baby-carriage':'👶','ti-heart-handshake':'🤝','ti-book':'📖','ti-device-speaker':'📢','ti-camera':'📷','ti-users':'👥','ti-leaf':'🌿','ti-pray':'🙏','ti-tool':'🔧'};
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let session = null, currentProfile = null;
let niveisAcesso = [];

// Helpers de permissão baseados em niveisAcesso
