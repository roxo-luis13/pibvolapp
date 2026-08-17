// ===== ESTADO GLOBAL =====
// ===== ESTADO =====
const ICONES = {'ti-music':'🎵','ti-baby-carriage':'👶','ti-heart-handshake':'🤝','ti-book':'📖','ti-device-speaker':'📢','ti-camera':'📷','ti-users':'👥','ti-leaf':'🌿','ti-pray':'🙏','ti-tool':'🔧'};
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ===== VERSÍCULOS DA DASHBOARD =====
const VERSICULOS = [
  {ref:'Colossenses 3:23-24', texto:'Tudo que fizerem, façam de todo o coração, como para o Senhor.'},
  {ref:'Marcos 10:45', texto:'Pois nem mesmo o Filho do Homem veio para ser servido, mas para servir.'},
  {ref:'Gálatas 5:13', texto:'Sirvam uns aos outros em amor.'},
  {ref:'1 Pedro 4:10', texto:'Deus deu a cada um de vocês um dom.'},
  {ref:'Romanos 12:1', texto:'Ofereçam seu corpo como sacrifício vivo.'},
  {ref:'Efésios 2:10', texto:'Somos criação de Deus, realizados em Cristo Jesus para boas obras.'},
  {ref:'Romanos 12:11', texto:'Nunca sejam preguiçosos, mas trabalhem com dedicação.'},
  {ref:'1 Coríntios 10:31', texto:'Façam tudo para a glória de Deus.'},
  {ref:'1 Coríntios 15:58', texto:'Sejam fortes e constantes. Trabalhem sempre para o Senhor.'},
  {ref:'1 Tessalonicenses 1:3', texto:'Seu trabalho é resultado de sua fé, e seu amor os motiva a trabalhar.'},
  {ref:'Mateus 25:40', texto:'Quando fizeram isso ao menor destes meus irmãos, foi a mim que fizeram.'},
  {ref:'Filipenses 2:4', texto:'Não pensem somente em seus próprios interesses, mas interessem-se também pelos outros.'},
  {ref:'Tiago 2:17', texto:'A fé por si mesma não é suficiente. Se não produzir boas obras, está morta.'},
  {ref:'Hebreus 10:24-25', texto:'Pensemos em maneiras de motivar uns aos outros.'},
  {ref:'Isaías 6:8', texto:'Eis-me aqui. Envia-me.'},
  {ref:'Lucas 10:2', texto:'A seara é grande, mas os trabalhadores são poucos.'},
];

function versiculoDoDia() {
  const hoje = new Date();
  const diasEpoca = Math.floor(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86400000);
  const s = Math.sin(diasEpoca) * 10000;
  const fracao = s - Math.floor(s);
  const idx = Math.floor(fracao * VERSICULOS.length);
  return VERSICULOS[idx];
}
let session = null, currentProfile = null;
let niveisAcesso = [];
let gruposMinisterios = [];

// Helpers de permissão baseados em niveisAcesso
