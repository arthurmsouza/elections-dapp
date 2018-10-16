import React, { Component } from "react";
import Web3 from "web3";
import utils from "web3-utils";
import abi from "../election-abi.json";
import { Provider } from "./Context";

import Home from "./Home";

export default class AppProvider extends Component {
  constructor(props) {
    super(props);

    const state = {
      user: {},
      candidates: [],
      pendingVoters: []
    };

    if (window.web3) {
      state.web3 = new Web3(window.web3.currentProvider);
      state.contract = new state.web3.eth.Contract(
        abi,
        "0x8700269ffb81ace4784ab27ecf9a633326c478e3"
      );
    }

    this.state = state;
  }

  async componentDidMount() {
    this.getContractState();
  }

  async getContractState() {
    const { web3, contract } = this.state;
    if (web3 && contract) {
      try {
        const userAddress = await web3.eth.getCoinbase();
        const registered = await contract.methods
          .voterIsRegistered(userAddress)
          .call();

        const owner = await contract.methods.owner().call();
        const userData = {
          registration: registered ? "pendingApproval" : "pendingRegistration",
          admin: owner.toLowerCase() === userAddress.toLowerCase(),
          address: userAddress.toLowerCase()
        };
        if (registered) {
          const approved = await contract.methods
            .registrationIsApproved(userAddress)
            .call();
          if (approved) {
            userData.registration = "approved";
            const hasVoted = await contract.methods
              .voterHasVoted(userAddress)
              .call();
            userData.voted = hasVoted;
          }
        }
        const candidates = await this.fetchCandidates(this.state.contract);
        this.setState({
          candidates,
          user: userData
        });
        console.log("user: ", userData);
      } catch (err) {
        console.warn("err: ", err);
      }
    }
  }

  async fetchCandidates() {
    const { contract } = this.state;
    const candidates = [];
    const count = await contract.methods.getCandidateCount().call();
    for (let i = 0; i < count; i++) {
      const bytesName = await contract.methods
        .getCandidateNameForIndex(i)
        .call();
      const votes = await contract.methods
        .getVoteCountForCandidate(bytesName)
        .call();
      candidates.push({
        name: utils.hexToUtf8(bytesName),
        votes
      });
    }
    return candidates;
  }

  async fetchPendingVoters() {
    const { contract } = this.state;
    const candidates = [];
    const count = await contract.methods.getCandidateCount().call();
    for (let i = 0; i < count; i++) {
      const bytesName = await contract.methods
        .getCandidateNameForIndex(i)
        .call();
      const votes = await contract.methods
        .getVoteCountForCandidate(bytesName)
        .call();
      candidates.push({
        name: utils.hexToUtf8(bytesName),
        votes
      });
    }
    return candidates;
  }

  // Web3 Calls

  vote = async name => {
    const { contract } = this.state;
    if (!contract) return new Error("Not connected to Web3");
    const hexName = utils.utf8ToHex(name);
    const address = this.state.user.address;
    return new Promise((resolve, reject) => {
      contract.methods
        .voteForCandidate(hexName)
        .send({ from: address })
        .on("error", error => {
          reject(error);
        })
        .on("receipt", receipt => {
          resolve(receipt);
        });
    });
  };

  approve = async address => {
    const { contract } = this.state;
    if (!contract) return new Error("Not connected to Web3");
    const ownAddr = this.state.user.address;
    return new Promise((resolve, reject) => {
      contract.methods
        .approveRegistration(address)
        .send({ from: ownAddr })
        .on("error", error => {
          reject(error);
        })
        .on("receipt", receipt => {
          resolve(receipt);
        });
    });
  };

  addCandidate = async name => {
    const { contract } = this.state;
    if (!contract) return new Error("Not connected to Web3");
    const hexName = utils.utf8ToHex(name);
    const address = this.state.user.address;
    return new Promise((resolve, reject) => {
      contract.methods
        .addCandidate(hexName)
        .send({ from: address })
        .on("error", error => {
          reject(error);
        })
        .on("receipt", receipt => {
          console.log("receipt", receipt);
          resolve(receipt);
          this.getContractState();
        });
    });
  };

  requestApproval = async () => {
    const { contract } = this.state;
    if (!contract) return new Error("Not connected to Web3");
    const address = this.state.user.address;
    return new Promise((resolve, reject) => {
      contract.methods
        .registerVoter()
        .send({ from: address })
        .on("error", error => {
          reject(error);
        })
        .on("receipt", receipt => {
          resolve(receipt);
        });
    });
  };

  batchApprove = async voters => {
    const { contract } = this.state;
    if (!contract) return new Error("Not connected to Web3");
    const ownAddr = this.state.user.address;
    return new Promise((resolve, reject) => {
      contract.methods
        .approveRegistrations(voters)
        .send({ from: ownAddr })
        .on("error", error => {
          reject(error);
        })
        .on("receipt", receipt => {
          resolve(receipt);
        });
    });
  };

  // Render

  render() {
    if (!this.state.web3) {
      return <span>Please install metamask to use this app.</span>;
    }
    return (
      <Provider
        value={{
          vote: this.vote,
          approve: this.approve,
          requestApproval: this.requestApproval,
          addCandidate: this.addCandidate,
          batchApprove: this.batchApprove,
          ...this.state
        }}
      >
        <Home />
      </Provider>
    );
  }
}
