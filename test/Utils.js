const createKeccakHash = require('keccak');

function toChecksumAddress (address) {
  address = address.toLowerCase().replace('0x', '');
  var hash = createKeccakHash('keccak256').update(address).digest('hex');
  var ret = '0x';

  for (var i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += address[i].toUpperCase();
    } else {
      ret += address[i];
    }
  }

  return ret;
}

// console.log(toChecksumAddress('0x5336949bfad7b9e1509ef36c835a566fc31a38a8'), 'presale pool address');
// console.log(toChecksumAddress('0xcf46fe1f2c456a7fd5adeb222548ef21aac5f0ca'), 'founders pool address');
// console.log(toChecksumAddress('0xdbfa2c8faf389d858b1c3049a6fa0f5cb8c8257a'), 'incentive reserve pool address');
// console.log(toChecksumAddress('0x95a3f2d786e3de6185f4959315fdbab766cc40fd'), 'general sale pool address');
// console.log(toChecksumAddress('0x030938c44f98c6d5cb2dae1c2b1ec9656cb0ee81'), 'lottery pool address');
// console.log(toChecksumAddress('0x311c071229d276c4599e77bf636d399c5d947a0f'), 'marketing pool address');
