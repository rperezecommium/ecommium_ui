/** Wait for the regular BFF read model, without replaying a confirmed command. */
export async function waitForCmsReceiptVisibility(
  read:()=>Promise<{ok:boolean;data?:{revisionToken?:string}}>,
  revisionToken:string,
  pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
):Promise<boolean> {
  for(const delay of [0,100,200,400,800,1000,1000,1000,1000]) {
    if(delay)await pause(delay);
    try {const result=await read();if(result.ok&&result.data?.revisionToken===revisionToken)return true;}catch{/* The confirmed command remains successful. */}
  }
  return false;
}
