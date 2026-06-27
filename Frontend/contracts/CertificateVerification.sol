// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CertificateVerification {

    struct Certificate {
        string  name;
        string  course;
        string  ipfsHash;
        uint256 issueDate;
        address issuer;
        bool    isValid;
        bool    isEdited;
    }

    address public owner;

    mapping(bytes32 => Certificate) public certificates;
    mapping(address => bool) public authorizedIssuers;

    event CertificateIssued(
        bytes32 indexed certHash,
        string  name,
        string  course,
        address indexed issuer,
        uint256 timestamp
    );

    event CertificateRevoked(
        bytes32 indexed certHash,
        address indexed revokedBy,
        uint256 timestamp
    );

    event CertificateEdited(
        bytes32 indexed certHash,
        string  name,
        string  course,
        address indexed issuer,
        uint256 timestamp
    );

    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAdded(msg.sender, msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    function addIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "Zero address");
        require(!authorizedIssuers[_issuer], "Already noted");

        authorizedIssuers[_issuer] = true;
        emit IssuerAdded(_issuer, msg.sender);
    }

    function removeIssuer(address _issuer) external onlyOwner {
        require(_issuer != owner, "Cannot remove the owner");

        authorizedIssuers[_issuer] = false;
        emit IssuerRemoved(_issuer, msg.sender);
    }

    function issueCertificate(
        bytes32 certHash,
        string calldata name,
        string calldata course,
        string calldata ipfsHash
    ) external {
        require(certificates[certHash].issueDate == 0, "Certificate already exists");
        require(bytes(name).length > 0, "Name required");
        require(bytes(course).length > 0, "Course required");

        certificates[certHash] = Certificate({
            name:      name,
            course:    course,
            ipfsHash:  ipfsHash,
            issueDate: block.timestamp,
            issuer:    msg.sender,
            isValid:   true,
            isEdited:  false
        });

        emit CertificateIssued(certHash, name, course, msg.sender, block.timestamp);
    }

    function editCertificate(
        bytes32 certHash,
        string calldata name,
        string calldata course,
        string calldata ipfsHash
    ) external {
        require(certificates[certHash].issueDate != 0, "Certificate not found");
        require(certificates[certHash].isValid, "Certificate is revoked");
        require(
            certificates[certHash].issuer == msg.sender,
            "Only the original issuer can edit this certificate"
        );
        require(bytes(name).length > 0, "Name required");
        require(bytes(course).length > 0, "Course required");

        certificates[certHash].name = name;
        certificates[certHash].course = course;
        certificates[certHash].ipfsHash = ipfsHash;
        certificates[certHash].isEdited = true;

        emit CertificateEdited(certHash, name, course, msg.sender, block.timestamp);
    }

    function revokeCertificate(bytes32 certHash) external {
        require(certificates[certHash].issueDate != 0, "Certificate not found");
        require(certificates[certHash].isValid, "Already revoked");
        require(
            certificates[certHash].issuer == msg.sender,
            "Only the original issuer can revoke this certificate"
        );

        certificates[certHash].isValid = false;

        emit CertificateRevoked(certHash, msg.sender, block.timestamp);
    }

    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (Certificate memory)
    {
        return certificates[certHash];
    }

    function isCertificateValid(bytes32 certHash)
        external
        view
        returns (bool)
    {
        return certificates[certHash].isValid;
    }
}