import { ethers } from 'ethers'
import config from '../../config'
import ERC20_ABI from '../../constants/abis/erc20'
import TOKEN from '../../contexts/BridgeTokens'
import {getNodeRpc} from '../../config/getNodeRpc'
import {formatCoin} from '../tools'

const Web3 = require('web3')
const web3 = new Web3()
let contract = new web3.eth.Contract(ERC20_ABI)

const ZERO = ethers.utils.bigNumberify('0')
const OUT_TOKEN_BALANCE = 'OUT_TOKEN_BALANCE'

const CHAINID = config.chainID

export function getLocalOutBalance (chainID, account, token) {
  let lstr = sessionStorage.getItem(OUT_TOKEN_BALANCE)
  if (!lstr) {
    return false
  } else {
    let lboj = JSON.parse(lstr)
    if (!lboj[CHAINID]) {
      return false
    } else if (!lboj[CHAINID][account]) {
      return false
    } else if (!lboj[CHAINID][account][chainID]) {
      return false
    } else if (!lboj[CHAINID][account][chainID][token]) {
      return false
    } else if ((Date.now() - lboj[CHAINID][account][chainID][token].timestamp) > (1000 * 60 * 10)) {
      return false
    } else {
      return {
        msg: 'Success',
        info: lboj[CHAINID][account][chainID][token]
      }
    }
  }
}

function setLocalOutBalance (chainID, account, token, data) {
  let lstr = sessionStorage.getItem(OUT_TOKEN_BALANCE)
  let lboj = {}
  if (!lstr) {
    lboj[CHAINID] = {}
    lboj[CHAINID][account] = {}
    lboj[CHAINID][account][chainID] = {}
    lboj[CHAINID][account][chainID][token] = {
      ...data,
      timestamp: Date.now()
    }
  } else {
    lboj = JSON.parse(lstr)
    if (!lboj[CHAINID]) {
      lboj[CHAINID] = {}
      lboj[CHAINID][account] = {}
      lboj[CHAINID][account][chainID] = {}
      lboj[CHAINID][account][chainID][token] = {
        ...data,
        timestamp: Date.now()
      }
    } else if (!lboj[CHAINID][account]) {
      lboj[CHAINID][account] = {}
      lboj[CHAINID][account][chainID] = {}
      lboj[CHAINID][account][chainID][token] = {
        ...data,
        timestamp: Date.now()
      }
    } else if (!lboj[CHAINID][account][chainID]) {
      lboj[CHAINID][account][chainID] = {}
      lboj[CHAINID][account][chainID][token] = {
        ...data,
        timestamp: Date.now()
      }
    } else {
      lboj[CHAINID][account][chainID][token] = {
        ...data,
        timestamp: Date.now()
      }
    }
  }
  sessionStorage.setItem(OUT_TOKEN_BALANCE, JSON.stringify(lboj))
}

function getOutTokenBalance (chainId, account, tokenList) {
  return new Promise(resolve => {

    const batch = new web3.BatchRequest()
    let BridgeToken = TOKEN[chainId]
    chainId = Number(chainId)
    web3.setProvider(getNodeRpc(chainId))
    let isHaveoutBaseCoin = true
    for (let token in tokenList) {
      let coin = formatCoin(tokenList[token].symbol)
      if (
        (coin === 'ETH' && (chainId === 1 || chainId === 4))
        || (coin === 'FSN' && (chainId === 32659 || chainId === 46688))
        || (coin === 'BNB' && (chainId === 56 || chainId === 97))
      ) {
        isHaveoutBaseCoin = false
        batch.add(web3.eth.getBalance.request(account, 'latest', (err, res) => {
          let bl
          if (err) {
            bl = ZERO
          } else {
            bl = ethers.utils.bigNumberify(res)
            setLocalOutBalance(chainId, account, token, {balance: bl.toString()})
            setLocalOutBalance(chainId, account, 'BASE', {balance: bl.toString()})
          }
          resolve('OVER')
        }))
      } else {
        contract.options.address = BridgeToken[coin].token
        let etbData = contract.methods.balanceOf(account).encodeABI()
        batch.add(web3.eth.call.request({data: etbData, to: BridgeToken[coin].token, from: account}, 'latest', (err, res) => {
          let bl
          if (err) {
            bl = ZERO
          } else {
            bl = ethers.utils.bigNumberify(res)
            setLocalOutBalance(chainId, account, token, {balance: bl.toString()})
          }
        }))
      }
    }
    if (isHaveoutBaseCoin) {
      batch.add(web3.eth.getBalance.request(account, 'latest', (err, res) => {
        let bl
        if (err) {
          bl = ZERO
        } else {
          bl = ethers.utils.bigNumberify(res)
          setLocalOutBalance(chainId, account, 'BASE', {balance: bl.toString()})
        }
        resolve('OVER')
      }))
    }
    batch.execute()
  })
}

let getBalanceInterval = ''

function getAllOutBalanceFn (allToken, account) {
  if (getBalanceInterval) clearTimeout(getBalanceInterval) 
  let arr = []
  for (let chainId in allToken) {
    arr.push(getOutTokenBalance(chainId, account, allToken[chainId]))
  }
  Promise.all(arr).then(res => {
    getBalanceInterval = setTimeout(() => {
      getAllOutBalance(allToken, account)
    }, 12000)
  })
}

export const getAllOutBalance = getAllOutBalanceFn