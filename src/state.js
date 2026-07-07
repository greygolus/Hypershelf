

/* ======================= state ======================= */
const state={files:[],folders:[],filter:{folder:null,tag:null,q:'',disk:false},
  disk:{handle:null,name:'',files:[],needsPerm:false},
  cur:null,mmode:'interact',codeOpen:false,themeOpen:false,dirty:false,srcDoc:null,selEl:null};


export { state };
