<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Редактор премии</title>

<style>

body{
font-family:Arial;
background:#f4f7fb;
padding:20px;
}

.form{
background:white;
padding:20px;
border-radius:20px;
margin-bottom:20px;
display:grid;
grid-template-columns:repeat(6,1fr);
gap:10px;
}

input,
select{
padding:12px;
border-radius:12px;
border:1px solid #ddd;
}

button{
border:none;
padding:12px;
border-radius:12px;
cursor:pointer;
font-weight:700;
}

.add{
background:#16a34a;
color:white;
}

.clear{
background:#ef4444;
color:white;
margin-bottom:20px;
}

.card{
background:white;
padding:20px;
border-radius:20px;
margin-bottom:15px;
display:flex;
justify-content:space-between;
align-items:center;
}

.actions{
display:flex;
gap:10px;
}

.edit{
background:#3b82f6;
color:white;
}

.delete{
background:#ef4444;
color:white;
}

@media(max-width:900px){

.form{
grid-template-columns:1fr;
}

.card{
flex-direction:column;
align-items:flex-start;
gap:15px;
}

}

</style>
</head>
<body>

<h1>Редактор премии</h1>

<button
class="clear"
onclick="clearProducts()">

Очистить всё

</button>

<div class="form">

<select id="group">
<option>Ароматизаторы</option>
<option>Автохимия</option>
<option>Неликвид</option>
<option>Масла</option>
</select>

<input
type="text"
id="name"
placeholder="Название товара">

<input
type="number"
id="plan"
placeholder="План">

<input
type="number"
id="sold"
placeholder="Продано">

<input
type="number"
id="bonus"
placeholder="Бонус">

<button
class="add"
onclick="saveProduct()">

Сохранить

</button>

</div>

<div id="list"></div>

<script>

let products = [];
let editIndex = null;

async function loadProducts(){

const res =
await fetch('products.json');

products =
await res.json();

renderProducts();

}

async function syncProducts(){

await fetch('save.php',{

method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify(products)

});

}

async function saveProduct(){

const product = {

group:
document.getElementById('group').value,

name:
document.getElementById('name').value,

plan:Number(
document.getElementById('plan').value
),

sold:Number(
document.getElementById('sold').value
),

bonus:Number(
document.getElementById('bonus').value
)

};

if(editIndex === null){

products.push(product);

}else{

products[editIndex] = product;
editIndex = null;

}

await syncProducts();

renderProducts();

clearForm();

}

function editProduct(index){

const p = products[index];

document.getElementById('group').value = p.group;
document.getElementById('name').value = p.name;
document.getElementById('plan').value = p.plan;
document.getElementById('sold').value = p.sold;
document.getElementById('bonus').value = p.bonus;

editIndex = index;

window.scrollTo({
top:0,
behavior:'smooth'
});

}

async function deleteProduct(index){

products.splice(index,1);

await syncProducts();

renderProducts();

}

async function clearProducts(){

if(confirm('Удалить все товары?')){

products = [];

await syncProducts();

renderProducts();

}

}

function clearForm(){

document.getElementById('name').value = '';
document.getElementById('plan').value = '';
document.getElementById('sold').value = '';
document.getElementById('bonus').value = '';

}

function renderProducts(){

const list =
document.getElementById('list');

list.innerHTML = '';

products.forEach((p,index)=>{

list.innerHTML += `

<div class="card">

<div>

<b>${p.name}</b><br>
${p.group}<br>
Продано: ${p.sold}/${p.plan}<br>
Бонус: ${p.bonus} ₽

</div>

<div class="actions">

<button
class="edit"
onclick="editProduct(${index})">

Изменить

</button>

<button
class="delete"
onclick="deleteProduct(${index})">

Удалить

</button>

</div>

</div>

`;

});

}

loadProducts();

</script>

</body>
</html>
