// Bulk selection for Studio's "Мои задачи". The key includes the project and episode
// so tasks from different series cannot accidentally affect one another.
export const bulkTaskKey=(projectId,episodeId,taskId)=>JSON.stringify([String(projectId),String(episodeId),String(taskId)]);

export function retainVisibleTasks(selected,rows){
  const visible=new Set(rows.map(({p,ep,t})=>bulkTaskKey(p.id,ep.id,t.id)));
  for(const key of selected)if(!visible.has(key))selected.delete(key);
  return selected;
}

// Changes only selected task records; roles, files, projects and unselected tasks are preserved.
// Call the workspace's normal persist/cloud sync pathway after applying the change.
export function deleteBulkTasks(state,keys){
  let removed=0;
  const touchedProjects=[];
  for(const project of state.projects||[]){
    let removedFromProject=0;
    for(const episode of project.episodes||[]){
      const previous=episode.tasks||[];
      const remaining=previous.filter(task=>!keys.has(bulkTaskKey(project.id,episode.id,task.id)));
      const count=previous.length-remaining.length;
      if(count){episode.tasks=remaining;removedFromProject+=count;}
    }
    if(removedFromProject){
      project.updatedAt=new Date().toISOString();
      touchedProjects.push(project.id);
      removed+=removedFromProject;
    }
  }
  return {removed,touchedProjects};
}
