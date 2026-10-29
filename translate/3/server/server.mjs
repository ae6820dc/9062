import http from 'node:http';
import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {Firestore} from '@google-cloud/firestore';
import {createHandler,createQuotaReservation,parseConfig} from './service.mjs';
const config=parseConfig(process.env);
const identity=new OAuth2Client(config.clientId),auth=new GoogleAuth({projectId:config.project,scopes:['https://www.googleapis.com/auth/cloud-translation']});
const db=new Firestore({projectId:config.project});
const client=await auth.getClient();
const handler=createHandler({config,
  verifyToken:async token=>(await identity.verifyIdToken({idToken:token,audience:config.clientId})).getPayload(),
  reserveQuota:createQuotaReservation(db),
  translate:async({source,target,text,signal})=>{
    const result=await client.request({url:`https://translation.googleapis.com/v3/projects/${config.project}/locations/global:translateText`,method:'POST',timeout:15000,retry:false,signal,data:{contents:[text],mimeType:'text/plain',sourceLanguageCode:source,targetLanguageCode:target,model:`projects/${config.project}/locations/global/models/general/nmt`}});
    return result.data.translations?.[0]?.translatedText;
  }
});
const server=http.createServer(handler);server.requestTimeout=20000;server.headersTimeout=10000;server.maxHeadersCount=30;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Unicode Translate 3 service listening.'));
// No phrase, ID token, email, API key or raw upstream errors are logged.
