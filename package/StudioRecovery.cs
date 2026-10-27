using System;

namespace FundiVoice {
    public sealed partial class StudioCloud {
        public object RecoveryRequests() {
            string server,token;
            lock(gate) {
                if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Studio к Cloud.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
            }
            return CloudHttp.Request(server,"/v1/studio/recovery/requests","GET",null,token);
        }
        public object RecoveryDecision(string actorId,string action) {
            if(action!="approve"&&action!="reject")
                throw new CloudFault(400,"invalid_recovery","Выбери одобрение или отклонение.");
            string server,token;
            lock(gate) {
                if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Studio к Cloud.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
            }
            return CloudHttp.Request(server,"/v1/studio/recovery/"+
                Uri.EscapeDataString(actorId)+"/decision","POST",new{action=action},token);
        }
    }
}
