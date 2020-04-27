export class DecentSignalSecretBox {
    constructor(password) {
        this.password = password;
    }

    async encryptMessage(message) {
    }

    async decryptMessage(message) {
    }
}

export class DecentSignalParty {
    onReceiveOffers = []

    constructor(partyId) {
        this.partyId = partyId;
    }

    set onReceiveOffer(callback) {
        this.onReceiveOffers.push(callback);
    }

    async createParty() {
    }

    async closeParty() {
    }

    async sendOffer(offer) {
    }
}

export class DecentSignalPeer {
    constructor(peerId) {
        this.peerId = peerId;
    }

    async createOffer() {
    }

    async acceptOffer() {
    }
}

export class DecentSignal {
    constructor(peer, party, secretBox) {
        this.peer = peer;
        this.party = party;
        this.secretBox = secretBox;
    }

    async startSignalling() {
        Promise.all([this.peer.createOffer(), this.party.createParty()])
            .then(([offer, _]) => this.secretBox.encryptMessage(offer))
            .then(offer => this.party.sendOffer(offer));
        this.party.onReceiveOffer = (offer) => {
            this.peer.acceptOffer(this.secretBox.decryptMessage(offer)).then();
        }
    }

    async stopSignalling() {
        this.party.closeParty().then();
    }
}
