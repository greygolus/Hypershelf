

/* ======================= state ======================= */
/* filter.disk holds the id of the disk folder being viewed, or false */
const state={files:[],folders:[],filter:{folder:null,tag:null,q:'',disk:false},
  disks:[], /* [{id,handle,name,files:[],needsPerm}] — connected real folders */
  cur:null,mmode:'interact',codeOpen:false,themeOpen:false,dirty:false,srcDoc:null,selEl:null};


export { state };
