const MAX_LEN = 5;

export function generate(){
let ans = "";
const word = "123456789qwertyuiopasdfghjklzxcvbnm";
for(let i = 0; i< MAX_LEN; i++){
    ans += word[Math.floor(Math.random() * word.length)];
}
return ans;
}