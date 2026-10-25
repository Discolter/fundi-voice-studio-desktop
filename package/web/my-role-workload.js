// Read-only workload summary for a person's own roles.
// Never treat an unentered character line count as zero.
export function myRoleLineCount(value){
  return Number.isInteger(value)&&value>=0?value:null;
}
export function myRoleWorkloadColor(value){
  const n=myRoleLineCount(value);
  return n===null?'unknown':n<=50?'low':n<=100?'medium':'high';
}
export function summarizeMyRoleEpisodes(entries){
  const episodes=new Map();
  let total=0,unknown=0;
  for(const item of entries){
    const {ep,r}=item;
    if(!episodes.has(ep.id))episodes.set(ep.id,{ep,items:[],total:0,unknown:0});
    const group=episodes.get(ep.id);
    group.items.push(item);
    const n=myRoleLineCount(r.lineCount);
    if(n===null){group.unknown++;unknown++;}
    else{group.total+=n;total+=n;}
  }
  return {
    total,unknown,episodes:[...episodes.values()].sort((a,b)=>
      Number(a.ep.number||0)-Number(b.ep.number||0)||
      String(a.ep.title||'').localeCompare(String(b.ep.title||''),'ru'))
  };
}
export const MY_ROLE_ORDERS=[
  ['original','По названию аниме'],
  ['linesDesc','Больше реплик сначала'],
  ['linesAsc','Меньше реплик сначала']
];
export function validMyRoleOrder(order){
  return MY_ROLE_ORDERS.some(([id])=>id===order)?order:'original';
}
export function sortMyRoleGroups(groups,order){
  if(validMyRoleOrder(order)==='original')return groups;
  const direction=order==='linesDesc'?-1:1;
  return groups.map((group,index)=>({...group,index,summary:summarizeMyRoleEpisodes(group.items)}))
    .sort((a,b)=>{
      // Incomplete totals are incomparable and always follow complete totals.
      const unknownA=a.summary.unknown>0,unknownB=b.summary.unknown>0;
      if(unknownA!==unknownB)return unknownA?1:-1;
      const delta=(a.summary.total-b.summary.total)*direction;
      return delta||a.index-b.index;
    });
}
