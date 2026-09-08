import * as THREE from 'three';
import { Journey } from '../client/journey.js';
import { revealReading } from '../shared/floor-reading.js';
import { esc, toast } from '../shared/ui.js';

export function orientationWidget(container,world){
 const element=document.createElement('div');element.className='view-orientation';element.setAttribute('aria-label','월드 축 시점');
 world.controls.minPolarAngle=0;world.controls.maxPolarAngle=Math.PI;
 const axes=[['X',1,0,0,'#ee7f88'],['−X',-1,0,0,'#a55661'],['Y',0,1,0,'#abd978'],['−Y',0,-1,0,'#739052'],['Z',0,0,1,'#76b9ed'],['−Z',0,0,-1,'#4a7f9e']];
 element.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true"></svg>'+axes.map(([name])=>`<button data-axis="${name}" aria-label="${name}축에서 보기">${name}</button>`).join('');container.append(element);
 let dragged=false,start=null,animationFrame=0;
 const update=()=>{const inverse=world.camera.quaternion.clone().invert();let lines='';axes.forEach(([name,x,y,z,color])=>{const p=new THREE.Vector3(x,y,z).applyQuaternion(inverse),button=element.querySelector(`[data-axis="${name}"]`);const left=60+p.x*39+(Math.hypot(p.x,p.y)<.2&&p.z<0?28:0),top=60-p.y*39;button.style.cssText=`left:${left}px;top:${top}px;background:${color};z-index:${Math.round(p.z*10)+12};opacity:${p.z<0?.7:1}`;lines+=`<line x1="60" y1="60" x2="${left}" y2="${top}" stroke="${color}" stroke-width="2" opacity=".65"/>`;});element.querySelector('svg').innerHTML=lines;};
 element.querySelectorAll('button').forEach(button=>button.onclick=e=>{if(dragged&&e.detail!==0)return;const axis=axes.find(a=>a[0]===button.dataset.axis),distance=world.camera.position.distanceTo(world.controls.target);const direction=new THREE.Vector3(axis[1],axis[2],axis[3]);if(Math.abs(direction.y)===1)direction.z=.00001;cancelAnimationFrame(animationFrame);
 const from=world.camera.position.clone().sub(world.controls.target).normalize(),to=direction.normalize();
 const rotation=new THREE.Quaternion().setFromUnitVectors(from,to),identity=new THREE.Quaternion(),began=performance.now();
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:480;
 element.dataset.animating='true';
 const animate=now=>{const t=duration?Math.min(1,(now-began)/duration):1,ease=t*t*(3-2*t);const offset=from.clone().applyQuaternion(identity.clone().slerp(rotation,ease));world.camera.position.copy(world.controls.target).addScaledVector(offset,distance);world.controls.update();update();if(t<1)animationFrame=requestAnimationFrame(animate);else element.dataset.animating='false';};
 animationFrame=requestAnimationFrame(animate);});
 element.onpointerdown=e=>{cancelAnimationFrame(animationFrame);element.dataset.animating="false";start={x:e.clientX,y:e.clientY};dragged=false;element.setPointerCapture(e.pointerId);};
 element.onpointermove=e=>{if(!start||!e.buttons)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)<3)return;dragged=true;const s=new THREE.Spherical().setFromVector3(world.camera.position.clone().sub(world.controls.target));s.theta-=dx*.01;s.phi=THREE.MathUtils.clamp(s.phi+dy*.01,.0001,Math.PI-.0001);world.camera.position.copy(world.controls.target).add(new THREE.Vector3().setFromSpherical(s));world.controls.update();start={x:e.clientX,y:e.clientY};};
 // Capture on the widget would retarget button clicks; dispatch an axis click on a stationary release.
 element.onpointerup=e=>{const wasDrag=dragged;start=null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);if(!wasDrag){const target=document.elementFromPoint(e.clientX,e.clientY);if(target?.matches('[data-axis]'))target.click();}dragged=true;};
 world.controls.addEventListener('change',update);update();return()=>{cancelAnimationFrame(animationFrame);world.controls.removeEventListener('change',update);element.remove();};
}

export function inlineReader(container,world,book,chapter,models,onExit){
 const host=document.createElement('section');host.className='inplace-reader reader';
 host.innerHTML=`<div class="reader-world"></div><div class="reader-mode-bar"><strong>독자 체험</strong><select aria-label="체험할 챕터">${book.chapters.map((c,i)=>`<option value="${i}" ${c.id===chapter.id?'selected':''}>${esc(c.title)}</option>`).join('')}</select><span>마우스를 누른 채 이동 · 방향키 / WASD</span><button id="exit-reader">편집으로 돌아가기</button></div><aside class="floor-reading-controls" hidden><h2 id="floor-title"></h2><img class="story-divider" src="/ornaments/story-divider.png" alt=""><p id="floor-accessible" tabindex="0" aria-label="이야기 본문"></p><div class="floor-pagination"><button id="floor-prev" aria-label="이전 글귀">←</button><span id="floor-page"></span><button id="floor-next" aria-label="다음 글귀">→</button></div></aside>`;
 container.append(host);world.keys.clear();world.controls.enabled=false;world.renderer.setAnimationLoop(null);world.renderer.domElement.style.visibility='hidden';
 const panel=host.querySelector('aside');let reader;
 try{reader=new Journey(host.querySelector('.reader-world'),{chapter,chapters:book.chapters,models,onError:toast,onChapter:index=>{host.querySelector('select').value=index;},onReading:state=>{panel.hidden=!state;if(!state)return;panel.querySelector('#floor-title').textContent=state.title;panel.querySelector('#floor-accessible').textContent=state.text;panel.querySelector('#floor-accessible').scrollTop=0;panel.querySelector('#floor-page').textContent=`${state.page+1} / ${state.count}`;panel.querySelector('#floor-prev').disabled=state.page===0;panel.querySelector('#floor-next').disabled=state.page===state.count-1;if(state.settings.floorStagger!==false)revealReading(panel);}});reader.setActive(true);reader.jump(book.chapters.findIndex(c=>c.id===chapter.id));}
 catch(error){host.remove();world.controls.enabled=true;world.renderer.domElement.style.visibility='';world.renderer.setAnimationLoop(t=>world.frame(t));throw error;}
 host.querySelector('select').onchange=e=>reader.jump(Number(e.target.value));host.querySelector('#floor-prev').onclick=()=>reader.turnReadingPage(-1);host.querySelector('#floor-next').onclick=()=>reader.turnReadingPage(1);
 let closed=false;const close=()=>{if(closed)return;closed=true;reader.dispose();host.remove();world.keys.clear();world.controls.enabled=true;world.renderer.domElement.style.visibility='';world.last=performance.now();world.renderer.setAnimationLoop(t=>world.frame(t));onExit();};
 host.querySelector('#exit-reader').onclick=close;reader.renderer.domElement.focus({preventScroll:true});return{close,reader};
}



