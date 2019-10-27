import PublisherNode from './PublisherNode';

const provider = 'wss://paritymainne1570826636862.nodes.deploy.radar.tech/?apikey=a0c1c14129f2f8c4463a39ab882b41b2e3e0c4dddae864a4';

const publisherNode = new PublisherNode(provider);
publisherNode.listen();
publisherNode.emit();
