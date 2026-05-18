// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CertificateVerification
/// @notice Smart contract for issuing, verifying, and revoking certificates
contract CertificateVerification {

    /// @notice Structure to store certificate details
    struct Certificate {
        string  name;
        string  course;
        string  ipfsHash;
        uint256 issueDate;
        address issuer;
        bool    isValid;
    }

    /// @notice The contract deployer / admin
    address public owner;

    /// @dev certHash → Certificate data
    mapping(bytes32 => Certificate) public certificates;

    /// @dev wallet address → authorized issuer (kept for admin reference only)
    mapping(address => bool) public authorizedIssuers;

    /// @notice Emitted when a certificate is issued
    event CertificateIssued(
        bytes32 indexed certHash,
        string  name,
        string  course,
        address indexed issuer,
        uint256 timestamp
    );

    /// @notice Emitted when a certificate is revoked
    event CertificateRevoked(
        bytes32 indexed certHash,
        address indexed revokedBy,
        uint256 timestamp
    );

    /// @notice Emitted when a new issuer is added
    event IssuerAdded(address indexed issuer, address indexed addedBy);

    /// @notice Emitted when an issuer is removed
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    /// @notice Constructor sets deployer as owner
    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAdded(msg.sender, msg.sender);
    }

    /// @notice Modifier to restrict access to the contract owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    /// @notice Add a noted issuer address (owner only, informational)
    function addIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "Zero address");
        require(!authorizedIssuers[_issuer], "Already noted");

        authorizedIssuers[_issuer] = true;
        emit IssuerAdded(_issuer, msg.sender);
    }

    /// @notice Remove a noted issuer address (owner only)
    function removeIssuer(address _issuer) external onlyOwner {
        require(_issuer != owner, "Cannot remove the owner");

        authorizedIssuers[_issuer] = false;
        emit IssuerRemoved(_issuer, msg.sender);
    }

    /// @notice Issue a new certificate — open to any connected wallet
    /// @param certHash Unique hash of certificate data
    /// @param name     Recipient name
    /// @param course   Course / credential name
    /// @param ipfsHash IPFS CID of the certificate file
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
            isValid:   true
        });

        emit CertificateIssued(certHash, name, course, msg.sender, block.timestamp);
    }

    /// @notice Revoke a certificate — only the original issuer of that certificate can revoke
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

    /// @notice Verify and fetch certificate details
    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (Certificate memory)
    {
        return certificates[certHash];
    }

    /// @notice Check if certificate is valid
    function isCertificateValid(bytes32 certHash)
        external
        view
        returns (bool)
    {
        return certificates[certHash].isValid;
    }
}