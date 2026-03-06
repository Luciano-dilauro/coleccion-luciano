const LS_KEY = "coleccion_luciano_v4";

const state={
data:{collections:[]},
currentId:null
};

const $=id=>document.getElementById(id);

function load(){
const raw=localStorage.getItem(LS_KEY);
state.data=raw?JSON.parse(raw):{collections:[]};
}

function save(){
localStorage.setItem(LS_KEY,JSON.stringify(state.data));
}

function uid(){
return crypto.randomUUID();
}

function createCollection(){

const input=$("#newCollectionName");

if(!input)return;

const name=input.value.trim();

if(!name){
alert("Poné un nombre para la colección.");
return;
}

const items=[];

for(let i=1;i<=24;i++){

items.push({
id:uid(),
label:"A"+i,
have:false,
rep:0
});

}

const col={
id:uid(),
name,
items
};

state.data.collections.push(col);

save();

renderCollections();

input.value="";

}

function renderCollections(){

const list=$("#collectionsList");

if(!list)return;

list.innerHTML="";

for(const col of state.data.collections){

const div=document.createElement("div");

div.className="card";
div.textContent=col.name;

div.addEventListener("click",()=>openCollection(col.id));

list.appendChild(div);

}

}

function openCollection(id){

state.currentId=id;

const list=$("#collectionsList");
const view=$("#collectionView");

list.style.display="none";
view.style.display="block";

renderCollectionView();

}

function renderCollectionView(){

const col=getCurrent();
const view=$("#collectionView");

view.innerHTML=`

<div class="card">

<button id="backBtn" class="btn">← Volver</button>

<h2>${col.name}</h2>

<p class="muted" id="repsText"></p>

<div class="row">

<button id="copyMissing" class="btn">Copiar faltantes</button>

<button id="copyRepeated" class="btn">Copiar repetidas</button>

</div>

<div id="grid" class="items-grid"></div>

<p class="muted" id="progressText"></p>

</div>

`;

$("#backBtn").onclick=closeCollection;

$("#copyMissing").onclick=()=>{
copyText(buildMissing(col));
};

$("#copyRepeated").onclick=()=>{
copyText(buildRepeated(col));
};

renderGrid();

}

function closeCollection(){

$("#collectionView").style.display="none";
$("#collectionsList").style.display="block";

state.currentId=null;

}

function getCurrent(){

return state.data.collections.find(c=>c.id===state.currentId);

}

function renderGrid(){

const col=getCurrent();
const grid=$("#grid");

grid.innerHTML="";

for(const it of col.items){

const cell=document.createElement("div");

cell.className="item"+(it.have?" have":"");

cell.textContent=it.label;

if(it.rep>0){

const badge=document.createElement("div");

badge.className="rep-badge";

badge.textContent=it.rep;

cell.appendChild(badge);

}

cell.onclick=()=>{

if(!it.have){

it.have=true;
it.rep=0;

}else{

it.rep++;

}

save();
renderGrid();

};

grid.appendChild(cell);

}

updateStats();

}

function updateStats(){

const col=getCurrent();

const owned=col.items.filter(i=>i.have).length;
const total=col.items.length;

$("#progressText").textContent=`Progreso: ${owned}/${total}`;

const reps=col.items.reduce((s,i)=>s+i.rep,0);

$("#repsText").textContent=`Repetidas: ${reps}`;

}

function buildMissing(col){

const arr=col.items.filter(i=>!i.have).map(i=>i.label);

return col.name+"\n\nMe faltan\n\n"+arr.join(", ");

}

function buildRepeated(col){

const arr=col.items
.filter(i=>i.rep>0)
.map(i=>i.label+" ("+i.rep+")");

return col.name+"\n\nRepetidas\n\n"+arr.join(", ");

}

async function copyText(text){

await navigator.clipboard.writeText(text);

alert("Lista copiada");

}

function init(){

load();

renderCollections();

$("#createCollectionBtn").onclick=createCollection;

}

document.addEventListener("DOMContentLoaded",init);
