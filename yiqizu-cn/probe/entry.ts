import {handleProbe} from './main';
import {cloudProbeDeps} from '../server/cloudbase';
export async function main(event:unknown){
 return handleProbe(event,cloudProbeDeps());
}
