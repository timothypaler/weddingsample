(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallScreen = () => window.innerWidth <= 760;
  const opening = $('#opening');
  const invitation = $('#invitation');
  invitation.inert = true;
  const openButton = $('#open-invitation');
  let hasOpened = false;
  let isOpening = false;
  let activeModal = null;
  let modalTrigger = null;
  let metrics = {};
  let scrollPosition = window.scrollY;
  let previousScroll = window.scrollY;
  let scrollVelocity = 0;
  let layoutDirty = true;
  let lastCanvasFrame = 0;

  // The couple's supplied recording starts with the opening gesture.
  const soundButton = $('#sound-toggle');
  const soundLabel = $('.sound-label');
  const weddingMusic = $('#wedding-music');
  let musicPlaying = false;
  weddingMusic.volume = .4;
  function syncMusicState() {
    musicPlaying = !weddingMusic.paused && !weddingMusic.ended;
    soundButton.classList.toggle('is-playing', musicPlaying);
    soundButton.setAttribute('aria-pressed', String(musicPlaying));
    soundButton.setAttribute('aria-label', musicPlaying ? 'Pause music' : 'Play music');
    soundLabel.textContent = musicPlaying ? 'Sound on' : 'Sound off';
  }
  async function setMusic(playing) {
    try {
      weddingMusic.volume = .4;
      if (playing) await weddingMusic.play();
      else weddingMusic.pause();
      syncMusicState();
    } catch (error) {
      syncMusicState();
      soundButton.setAttribute('aria-label', 'Play music');
    }
  }
  weddingMusic.addEventListener('play', syncMusicState);
  weddingMusic.addEventListener('pause', syncMusicState);
  weddingMusic.addEventListener('error', syncMusicState);
  soundButton.addEventListener('click', () => setMusic(!musicPlaying));

  function openInvitation() {
    if (isOpening || hasOpened) return;
    isOpening = true;
    setMusic(true);
    opening.classList.add('unfolding');
    document.body.classList.add('has-opened');
    window.setTimeout(() => {
      hasOpened = true;
      isOpening = false;
      opening.hidden = true;
      invitation.inert = false;
      document.body.classList.remove('is-closed');
      $('#home').setAttribute('tabindex', '-1');
      $('#home').focus({ preventScroll:true });
      measureLayout();
    }, reducedMotion ? 150 : 2450);
  }

  openButton.addEventListener('click', openInvitation);
  opening.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); openButton.focus(); }
  });
  $('#replay-opening').addEventListener('click', () => {
    hasOpened = false;
    document.body.classList.add('is-closed');
    document.body.classList.remove('has-opened', 'is-reading');
    window.scrollTo({top:0,behavior:'instant'});
    scrollPosition = 0;
    invitation.inert = true;
    opening.classList.remove('unfolding');
    opening.hidden = false;
    setMusic(false);
    weddingMusic.currentTime = 0;
    openButton.focus({preventScroll:true});
  });
  openButton.focus({ preventScroll:true });
  // Keep the closed cover stable if a browser restores an old scroll position.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0,0);

  // Carry the vow scene's opposing text motion through every chapter.
  // Each line keeps its natural document position; only its painted layer moves.
  const motionHeadings = $$('.display, .program-heading h3, .event-row h3, .moments-heading h2, .footer-names');
  const motionLines = [];
  motionHeadings.forEach((heading, headingIndex) => {
    const parts = heading.innerHTML.split(/<br\s*\/?\s*>/i);
    const accessibleLabel = parts.map(part => {
      const fragment = document.createElement('span');
      fragment.innerHTML = part;
      return fragment.textContent.trim();
    }).join(' ');
    heading.setAttribute('aria-label', accessibleLabel);
    heading.classList.remove('reveal');
    heading.classList.add('scroll-heading');
    heading.replaceChildren();
    parts.forEach((part, lineIndex) => {
      if (lineIndex) heading.append(document.createTextNode(' '));
      const line = document.createElement('span');
      line.className = 'scroll-heading-line';
      line.innerHTML = part;
      line.setAttribute('aria-hidden', 'true');
      heading.append(line);
      motionLines.push({node:line,root:heading,index:lineIndex,direction:(lineIndex+headingIndex)%2 ? 1 : -1});
    });
  });
  const motionPanels = $$('.story-art, .date-block, .attire-art, .day-photo, .map-card, .program-list, .rsvp-photo');
  motionPanels.forEach(node => {node.classList.remove('reveal');node.classList.add('scroll-panel');});
  const motionPhotos = $$('.story-photo > img, .story-detail > img, .day-photo > img, .rsvp-photo > img');

  // Original vector ornamentation. All photographs remain the licensed originals.
  const ornamentViewBoxes = {'garden-spray':'0 0 280 440',laurel:'0 0 240 240',rings:'0 0 100 70',corner:'0 0 150 150',flourish:'0 0 320 65'};
  function ornament(symbol, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',ornamentViewBoxes[symbol]);
    svg.setAttribute('class',className);
    svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href',`assets/wedding-ornaments.svg#${symbol}`);
    svg.append(use);
    return svg;
  }
  const decoratedScenes = $$('.hero, main > .section-pad, .vow-sticky, .moments-sticky');
  decoratedScenes.forEach((scene,index) => {
    scene.classList.add('decorated-scene');
    if(index%2)scene.classList.add('ornament-reverse');
    const layer = document.createElement('div');
    layer.className = 'chapter-ornaments';
    layer.setAttribute('aria-hidden','true');
    layer.append(ornament('garden-spray','garden-spray garden-spray-left'),ornament('garden-spray','garden-spray garden-spray-right'));
    const frame = document.createElement('div');
    frame.className = 'chapter-fine-corners';
    frame.append(ornament('corner','fine-corner corner-top'),ornament('corner','fine-corner corner-bottom'));
    layer.append(frame);
    if(scene.matches('.story, .day, .details, .venue, .notes'))layer.append(ornament('rings','chapter-rings'));
    scene.prepend(layer);
  });
  $$('.story-text, .attire-copy, .venue-copy, .rsvp-content').forEach(parent=>{
    const flourish=ornament('flourish','heading-flourish');
    const heading=$('.display',parent);
    if(heading)heading.after(flourish);
  });
  const vowLaurel = ornament('laurel','vow-laurel');
  $('.vow-sticky').append(vowLaurel);
  const heroLaurel = ornament('laurel','hero-laurel');
  $('.hero').append(heroLaurel);
  const storySeal = document.createElement('div');
  storySeal.className='story-keepsake-seal';
  storySeal.setAttribute('aria-hidden','true');
  storySeal.append(ornament('laurel','keepsake-laurel'));
  const sealType=document.createElement('span');sealType.innerHTML='E <i>&</i> G';storySeal.append(sealType);
  $('.story-art').append(storySeal);

  // Layered paper silhouettes bridge each chapter without changing scroll scenes.
  const sectionColors = {home:'#34412f',letter:'#f3efe5',story:'#e8e6da',promise:'#293421',day:'#f3efe5',moments:'#33422e',details:'#f3efe5',venue:'#e5e5d9',notes:'#f3efe5',rsvp:'#dedecf'};
  const chapterSections = $$('main > section');
  chapterSections.slice(1).forEach((section,index)=>{
    const previous=chapterSections[index];
    const bridge=document.createElement('div');
    bridge.className='chapter-bridge bridge-style-'+(index%3);
    bridge.setAttribute('aria-hidden','true');
    bridge.style.setProperty('--bridge-paper',sectionColors[section.id]||'#f3efe5');
    bridge.innerHTML=`<svg class="bridge-silhouette" viewBox="0 0 1440 150" preserveAspectRatio="none"><path class="bridge-shadow" d="M0 115 C210 115 220 50 450 70 S650 127 720 44 C790 127 990 70 990 70 C1220 50 1230 115 1440 115 V150 H0Z"/><path class="bridge-paper" d="M0 123 C210 123 240 63 450 82 S650 135 720 56 C790 135 990 82 990 82 C1200 63 1230 123 1440 123 V150 H0Z"/><path class="bridge-gold" d="M0 114 C210 114 240 54 450 73 S650 126 720 47 C790 126 990 73 990 73 C1200 54 1230 114 1440 114"/></svg>`;
    const badge=document.createElement('div');badge.className='bridge-badge';badge.append(ornament(index%2?'rings':'flourish','bridge-emblem'));
    bridge.append(badge);
    const host=previous.matches('.vow-scene')?$('.vow-sticky',previous):previous.matches('.moments')?$('.moments-sticky',previous):previous;
    host.append(bridge);
    host.classList.add('has-chapter-bridge');
  });

  const revealNodes = $$('.reveal, .photo-reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold:.12, rootMargin:'0px 0px -25px 0px' });
    revealNodes.forEach(node => observer.observe(node));
  } else revealNodes.forEach(node => node.classList.add('is-visible'));

  // Break only this short display paragraph into readable, accessible words.
  const wordParagraph = $('[data-word-reveal]');
  const originalWords = wordParagraph.textContent.trim();
  wordParagraph.setAttribute('aria-label', originalWords);
  wordParagraph.textContent = '';
  originalWords.split(/\s+/).forEach((word, i) => {
    if (i) wordParagraph.append(' ');
    const span = document.createElement('span');
    span.textContent = word;
    span.className = 'word';
    span.setAttribute('aria-hidden','true');
    wordParagraph.append(span);
  });
  const wordNodes = $$('.word', wordParagraph);
  const parallaxNodes = $$('[data-parallax]');
  const parallaxImages = $$('[data-parallax-image]');
  const chapters = $$('[data-section]');
  const chapterName = $('#chapter-name');
  const chapterNumber = $('#chapter-number');
  const header = $('#site-header');
  const filmTrack = $('#film-track');
  const heroWrap = $('.hero-image-wrap');
  const heroTitle = $('.hero-names');
  const navLinks = $$('.desktop-nav a');
  let currentChapter = '';

  function documentTop(node) {
    const translation = (node.style.translate || '0 0').split(' ');
    return node.getBoundingClientRect().top + window.scrollY - (parseFloat(translation[1]) || 0);
  }
  function measureLayout() {
    const vh = window.innerHeight;
    metrics = {
      vh, width:window.innerWidth,
      heroHeight:$('.hero').offsetHeight,
      letterTop:documentTop(wordParagraph),
      letterHeight:wordParagraph.offsetHeight,
      vowTop:documentTop($('.vow-scene')),
      vowRange:Math.max(1,$('.vow-scene').offsetHeight-vh),
      filmTop:documentTop($('.moments')),
      filmRange:Math.max(1,$('.moments').offsetHeight-vh),
      filmTravel:Math.max(0,filmTrack.scrollWidth + (smallScreen()?window.innerWidth*.18:window.innerWidth*.47) - window.innerWidth + window.innerWidth*.05),
      total:Math.max(1,document.documentElement.scrollHeight-vh),
      parallax:parallaxNodes.map(node=>({node,top:documentTop(node),height:node.offsetHeight,amount:Number(node.dataset.parallax)})),
      images:parallaxImages.map(node=>({node,top:documentTop(node.parentElement),height:node.parentElement.offsetHeight,amount:Number(node.dataset.parallaxImage)})),
      lines:motionLines.map(item=>({...item,top:documentTop(item.root),height:item.root.offsetHeight})),
      panels:motionPanels.map((node,i)=>({node,top:documentTop(node),height:node.offsetHeight,direction:i%2?1:-1})),
      photoZooms:motionPhotos.map(node=>({node,top:documentTop(node.parentElement),height:node.parentElement.offsetHeight})),
      ornaments:decoratedScenes.map(node=>({node,top:documentTop(node),height:node.offsetHeight})),
      chapters:chapters.map((node,i)=>({node,top:documentTop(node),height:node.offsetHeight,name:node.dataset.section,i})),
      nav:navLinks.map(node=>({node,top:documentTop($(node.getAttribute('href')))}))
    };
    layoutDirty = false;
    resizeCanvas();
  }

  function updateScroll() {
    if (!metrics.vh) return;
    const target = window.scrollY;
    scrollPosition += (target - scrollPosition) * .11;
    if (Math.abs(target-scrollPosition)<.1) scrollPosition=target;
    scrollVelocity += ((target - previousScroll) - scrollVelocity) * .12;
    previousScroll = target;
    const y=scrollPosition, vh=metrics.vh;
    header.classList.toggle('is-sticky', target > metrics.heroHeight - 90);
    document.body.classList.toggle('is-reading', target > metrics.heroHeight * .8 && hasOpened);
    $('#reading-progress').style.transform=`scaleX(${clamp(target/metrics.total)})`;
    if (!reducedMotion) {
      if(y<metrics.heroHeight+vh){
        heroWrap.style.transform=`translate3d(0,${y*.28}px,0)`;
        heroTitle.style.translate=`0 ${y*-.12}px`;
        heroTitle.style.opacity=String(clamp(1-y/(metrics.heroHeight*.9)));
      }
      const wordProgress=clamp((target+vh*.8-metrics.letterTop)/(metrics.letterHeight+vh*.22));
      wordNodes.forEach((word,i)=>{word.style.opacity=String(.18+.82*clamp((wordProgress-i/wordNodes.length)*7));});
      wordParagraph.style.translate=`${(1-clamp(wordProgress*1.3))*-Math.min(100,metrics.width*.1)}px 0`;
      metrics.lines.forEach(({node,top,height,index,direction})=>{
        const progress=clamp((y+vh*.93-top)/(vh*.56+Math.min(height*.3,130))-index*.055);
        const entry=1-Math.pow(1-progress,3);
        const exit=clamp((y-top-height+vh*.02)/(vh*.55));
        const distance=Math.min(smallScreen()?72:180,metrics.width*(smallScreen()?.18:.12));
        node.style.transform=`translate3d(${direction*((1-entry)*distance-exit*distance*.14)}px,${(1-entry)*18}px,0)`;
        node.style.opacity=String((.18+.82*entry)*(1-exit*.7));
      });
      metrics.panels.forEach(({node,top,height,direction})=>{
        if(top+height<y-vh*.2||top>y+vh*1.2)return;
        const progress=clamp((y+vh*.92-top)/(vh*.58));
        const entry=1-Math.pow(1-progress,3);
        node.style.translate=`${direction*(1-entry)*(smallScreen()?24:65)}px 0`;
        node.style.opacity=String(.35+.65*entry);
      });
      metrics.photoZooms.forEach(({node,top,height})=>{
        if(top+height<y-vh*.2||top>y+vh*1.2)return;
        const progress=clamp((y+vh-top)/(vh+height));
        node.style.scale=String(1.12-progress*.12);
        node.style.transition='none';
      });
      metrics.ornaments.forEach(({node,top,height})=>{
        if(top+height<y-vh*.2||top>y+vh*1.2)return;
        const progress=clamp((y+vh-top)/(vh+height));
        node.style.setProperty('--chapter-progress',String(progress));
        node.style.setProperty('--ornament-drift',`${(progress-.5)*(smallScreen()?35:85)}px`);
        node.style.setProperty('--ornament-rotation',`${(progress-.5)*9}deg`);
      });
      metrics.parallax.forEach(({node,top,height,amount})=>{
        if(top+height>y-vh*.25&&top<y+vh*1.25){
          const relative=(y+vh/2-top-height/2)/vh;
          node.style.translate=`0 ${clamp(relative,-1.5,1.5)*amount*(smallScreen()?.55:1)}px`;
        }
      });
      metrics.images.forEach(({node,top,height,amount})=>{
        if(top+height>y-vh*.2&&top<y+vh*1.2){
          const relative=(y+vh/2-top-height/2)/vh;
          node.style.translate=`0 ${clamp(relative,-1,1)*amount*(smallScreen()?.6:1)}px`;
        }
      });
      const vowProgress=clamp((y-metrics.vowTop)/metrics.vowRange);
      if(y>metrics.vowTop-vh&&y<metrics.vowTop+metrics.vowRange+vh){
        $('.vow-sticky>img').style.transform=`scale(${1.18-vowProgress*.18}) translateY(${(vowProgress-.5)*-35}px)`;
        $('.vow-line.first').style.transform=`translateX(${(1-clamp(vowProgress/.4))*-12}vw)`;
        $('.vow-line.first').style.opacity=String(.25+.75*clamp(vowProgress/.35));
        $('.vow-line.last').style.transform=`translateX(${(1-clamp((vowProgress-.12)/.48))*12}vw)`;
        $('.vow-line.last').style.opacity=String(.15+.85*clamp((vowProgress-.12)/.48));
      }
      const filmProgress=clamp((y-metrics.filmTop)/metrics.filmRange);
      if(y>metrics.filmTop-vh&&y<metrics.filmTop+metrics.filmRange+vh){
        filmTrack.style.transform=`translate3d(${-filmProgress*metrics.filmTravel}px,0,0)`;
        $('#film-progress').style.transform=`scaleX(${filmProgress})`;
        const fade=smallScreen()?1:clamp(1-filmProgress*4.5);
        $('.moments-heading').style.opacity=String(fade);
      }
    } else {
      wordNodes.forEach(word=>word.style.opacity='1');
      motionLines.forEach(({node})=>{node.style.transform='none';node.style.opacity='1';});
    }
    const active = [...metrics.chapters].reverse().find(ch=>target+vh*.42>=ch.top);
    if(active && active.name!==currentChapter){
      currentChapter=active.name;
      chapterName.textContent=active.name;
      chapterNumber.textContent=String(active.i+1).padStart(2,'0');
    }
    let activeNav = null;
    metrics.nav.forEach(item=>{if(target+vh*.4>=item.top) activeNav=item.node;});
    navLinks.forEach(node=>node.classList.toggle('active',node===activeNav));
  }

  window.addEventListener('resize',()=>{layoutDirty=true;},{passive:true});
  window.addEventListener('orientationchange',()=>{layoutDirty=true;},{passive:true});
  window.addEventListener('load',()=>{layoutDirty=true;});
  if(document.fonts?.ready)document.fonts.ready.then(()=>{layoutDirty=true;});
  $$('img').forEach(img=>img.addEventListener('load',()=>{layoutDirty=true;},{once:true}));

  // A restrained field of warm glints, with its own scroll depth.
  const canvas=$('#particles');
  const ctx=canvas.getContext('2d');
  let particles=[];
  let canvasWidth=0,canvasHeight=0;
  function resizeCanvas(){
    if(!ctx)return;
    const ratio=Math.min(window.devicePixelRatio||1,1.8);
    canvasWidth=window.innerWidth;canvasHeight=window.innerHeight;
    canvas.width=Math.round(canvasWidth*ratio);canvas.height=Math.round(canvasHeight*ratio);
    canvas.style.width=`${canvasWidth}px`;canvas.style.height=`${canvasHeight}px`;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    if(!particles.length)particles=Array.from({length:smallScreen()?22:42},(_,i)=>({x:Math.random(),y:Math.random(),r:Math.random()*1.3+.35,speed:Math.random()*.007+.003,phase:Math.random()*Math.PI*2,glint:i%6===0}));
  }
  function drawParticles(time){
    if(!ctx||reducedMotion||!hasOpened||document.hidden||time-lastCanvasFrame<32)return;
    lastCanvasFrame=time;
    ctx.clearRect(0,0,canvasWidth,canvasHeight);
    const t=time*.001;
    particles.forEach(p=>{
      const twinkle=(Math.sin(t*(p.speed*90+.5)+p.phase)+1)/2;
      const opacity=.12+twinkle*.48;
      const x=(p.x*canvasWidth+Math.sin(t*.18+p.phase)*22+canvasWidth)%canvasWidth;
      const y=((p.y*canvasHeight-t*p.speed*80-scrollPosition*.065)%(canvasHeight+40)+canvasHeight+40)%(canvasHeight+40)-20;
      ctx.beginPath();ctx.fillStyle=`rgba(178,144,78,${opacity})`;
      ctx.shadowColor='rgba(219,190,117,.75)';ctx.shadowBlur=p.glint?10:5;
      if(p.glint&&twinkle>.6){
        const radius=p.r*3.3*twinkle;
        ctx.moveTo(x,y-radius);ctx.quadraticCurveTo(x+radius*.15,y-radius*.15,x+radius,y);ctx.quadraticCurveTo(x+radius*.15,y+radius*.15,x,y+radius);ctx.quadraticCurveTo(x-radius*.15,y+radius*.15,x-radius,y);ctx.quadraticCurveTo(x-radius*.15,y-radius*.15,x,y-radius);
      }else ctx.arc(x,y,p.r,0,Math.PI*2);
      ctx.fill();
    });
    ctx.shadowBlur=0;
  }
  const cursorGlow=$('#cursor-glow');
  if(window.matchMedia('(pointer:fine)').matches){
    window.addEventListener('pointermove',event=>{cursorGlow.style.left=`${event.clientX}px`;cursorGlow.style.top=`${event.clientY}px`;},{passive:true});
  }
  function frame(time){
    if(layoutDirty)measureLayout();
    if(!document.hidden){updateScroll();drawParticles(time);}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // The sample date is explicitly in Philippine time.
  const weddingDate=new Date('2027-02-21T15:30:00+08:00').getTime();
  function updateCountdown(){
    const diff=Math.max(0,weddingDate-Date.now());
    const units={days:Math.floor(diff/86400000),hours:Math.floor(diff/3600000)%24,minutes:Math.floor(diff/60000)%60,seconds:Math.floor(diff/1000)%60};
    Object.entries(units).forEach(([unit,value])=>{$(`#count-${unit}`).textContent=String(value).padStart(unit==='days'?3:2,'0');});
  }
  updateCountdown();window.setInterval(updateCountdown,1000);
  function downloadCalendar(){
    const escapeText=text=>text.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//The Art of Forever//Wedding Concept//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:elena-gabriel-20270221@wedding-sample.local','DTSTAMP:20261026T000000Z','DTSTART:20270221T073000Z','DTEND:20270221T140000Z','SUMMARY:'+escapeText('Elena & Gabriel — Wedding invitation sample'),'LOCATION:'+escapeText('Tagaytay, Cavite, Philippines (illustrative venue)'),'DESCRIPTION:'+escapeText('Fictional wedding invitation concept. Ceremony at 3:30 PM Philippine time. Event and venue details are samples.'),'END:VEVENT','END:VCALENDAR'];
    const folded=lines.map(line=>{
      let result='',current='',bytes=0;
      for(const char of line){const length=new TextEncoder().encode(char).length;if(bytes+length>72){result+=current+'\r\n ';current='';bytes=1;}current+=char;bytes+=length;}
      return result+current;
    });
    const blob=new Blob([folded.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='Elena-Gabriel-Sample-Wedding.ics';document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(link.href),2000);
  }
  $$('[data-calendar]').forEach(button=>button.addEventListener('click',downloadCalendar));

  // Preview only: no API calls, SMS links, coordinator numbers, or data storage.
  const rsvpForm=$('#rsvp-form');
  const attendance=$$('input[name="attendance"]');
  attendance.forEach(input=>input.addEventListener('change',()=>{
    const declining=$('input[name="attendance"]:checked').value==='no';
    $('#guest-count').disabled=declining;
    $('#guest-food').disabled=declining;
    $('#rsvp-result').hidden=true;
  }));
  rsvpForm.addEventListener('submit',event=>{
    event.preventDefault();
    if(!rsvpForm.reportValidity())return;
    const name=$('#guest-name').value.trim();
    if(!name){$('#guest-name').setCustomValidity('Please enter your name.');$('#guest-name').reportValidity();return;}
    const accepted=$('input[name="attendance"]:checked').value==='yes';
    const result=$('#rsvp-result');
    result.replaceChildren();
    const heading=document.createElement('strong');
    heading.textContent=accepted?`A little happy dance for ${name}.`:`Thank you for letting us know, ${name}.`;
    result.append(heading,document.createTextNode(accepted?'This is a sample confirmation. No RSVP has been sent and your information has not been stored. On an actual invitation, your reply can be sent to the coordinator.':'This is a sample confirmation. No message has been sent and your information has not been stored.'));
    result.hidden=false;
    result.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'nearest'});
  });
  $('#guest-name').addEventListener('input',()=>$('#guest-name').setCustomValidity(''));

  // Native dialog provides focus containment, Escape support and inert background.
  const galleryPhotos=[
    {src:'assets/gallery-1.webp',alt:'Wedding rings held in a quiet, intimate moment',caption:'01 / The little things'},
    {src:'assets/gallery-2.webp',alt:'Wedding rings resting among soft pink roses',caption:'02 / All the in-between'},
    {src:'assets/gallery-3.webp',alt:'A distant bride and groom walking hand in hand at sunset',caption:'03 / The feeling of forever'},
    {src:'assets/gallery-4.webp',alt:'A wedding table beautifully set for a garden celebration',caption:'04 / Everything, together'}
  ];
  let galleryIndex=0;
  function showPhoto(index){
    galleryIndex=(index+galleryPhotos.length)%galleryPhotos.length;
    const photo=galleryPhotos[galleryIndex],img=$('#lightbox-image');
    img.src=photo.src;img.alt=photo.alt;
    $('#lightbox-caption').textContent=`${photo.caption} · ${galleryIndex+1} / ${galleryPhotos.length}`;
  }
  function openModal(id,trigger){
    const dialog=$(`#${id}`);modalTrigger=trigger;activeModal=dialog;
    dialog.showModal();document.body.style.overflow='hidden';
  }
  $$('[data-gallery]').forEach(button=>button.addEventListener('click',()=>{showPhoto(Number(button.dataset.gallery));openModal('lightbox',button);}));
  $('#lightbox-prev').addEventListener('click',()=>showPhoto(galleryIndex-1));
  $('#lightbox-next').addEventListener('click',()=>showPhoto(galleryIndex+1));
  $('#lightbox').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(galleryIndex-1);}if(event.key==='ArrowRight'){event.preventDefault();showPhoto(galleryIndex+1);}});
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>$(`#${button.dataset.close}`).close()));
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom||dialog.id==='lightbox')dialog.close();}});
    dialog.addEventListener('close',()=>{document.body.style.overflow='';activeModal=null;modalTrigger?.focus({preventScroll:true});layoutDirty=true;});
  });
  $('#open-credits').addEventListener('click',event=>openModal('credits-dialog',event.currentTarget));
  fetch('assets/photo-credits.json').then(response=>{if(!response.ok)throw new Error('Photo source record unavailable');return response.json();}).then(data=>{
    const container=$('#photo-credits');
    data.assets.filter(asset=>asset.used_in_site).forEach(asset=>{
      const row=document.createElement('div');row.className='photo-credit';
      const copy=document.createElement('div');const title=document.createElement('p');title.textContent=asset.photographer;
      const subtitle=document.createElement('small');subtitle.textContent=asset.title;copy.append(title,subtitle);
      const link=document.createElement('a');link.href=asset.source_page;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View original ↗';
      row.append(copy,link);container.append(row);
    });
    const license=document.createElement('a');license.href=data.license_url;license.target='_blank';license.rel='noopener noreferrer';license.textContent='Read the Unsplash License ↗';license.className='text-button';container.append(license);
  }).catch(()=>{const p=document.createElement('p');p.textContent='Photography source information is included in the photo-credits.json file. Photos are used under the Unsplash License.';$('#photo-credits').append(p);});
})();
