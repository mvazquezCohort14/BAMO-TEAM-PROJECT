// CAROUSEL

const slides=document.querySelectorAll(".slide");
const next=document.querySelector(".next");
const prev=document.querySelector(".prev");

let current=0;

function showSlide(index){

slides.forEach(slide=>slide.classList.remove("active"));
slides[index].classList.add("active");

}

next.addEventListener("click",()=>{

current=(current+1)%slides.length;
showSlide(current);

});

prev.addEventListener("click",()=>{

current=(current-1+slides.length)%slides.length;
showSlide(current);

});

setInterval(()=>{

current=(current+1)%slides.length;
showSlide(current);

},5000);



// ACTIVE NAV LINK

const sections=document.querySelectorAll("section");
const navLinks=document.querySelectorAll(".nav-link");

window.addEventListener("scroll",()=>{

let currentSection="";

sections.forEach(section=>{

const sectionTop=section.offsetTop-150;

if(window.scrollY>=sectionTop){

currentSection=section.getAttribute("id");

}

});

navLinks.forEach(link=>{

link.classList.remove("active");

if(link.getAttribute("href")==="#"+currentSection){

link.classList.add("active");

}

});

});



// DONATION

document.getElementById("donationForm").addEventListener("submit",function(e){

e.preventDefault();

const name=document.getElementById("donorName").value;
const amount=document.getElementById("donationAmount").value;

if(amount<=0){

document.getElementById("donationMessage").innerText="Please enter a valid donation amount.";

return;

}

document.getElementById("donationMessage").innerText=`Thank you ${name} for donating $${amount}!`;

this.reset();

});



// GRANT

document.getElementById("grantForm").addEventListener("submit",function(e){

e.preventDefault();

document.getElementById("grantMessage").innerText="Your grant application has been submitted successfully.";

this.reset();

});