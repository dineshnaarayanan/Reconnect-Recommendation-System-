/**
 * Pre-populated professional profiles and initial friendship links
 * to seed the recommendation engine.
 */

const initialUsers = [
    {
        id: 'u1',
        name: 'Alice Vance',
        title: 'Senior Software Engineer',
        company: 'Google',
        skills: ['React', 'Data Structures', 'System Design'],
        avatarColor: '#4285F4' // Google Blue
    },
    {
        id: 'u2',
        name: 'Bob Miller',
        title: 'Lead Product Manager',
        company: 'LinkedIn',
        skills: ['Product Strategy', 'Agile', 'Growth Hacking'],
        avatarColor: '#0077B5' // LinkedIn Blue
    },
    {
        id: 'u3',
        name: 'Charlie Ding',
        title: 'Senior Frontend Developer',
        company: 'Netflix',
        skills: ['TypeScript', 'WebGL', 'Performance Optimization'],
        avatarColor: '#E50914' // Netflix Red
    },
    {
        id: 'u4',
        name: 'Diana Ross',
        title: 'UX Researcher & Designer',
        company: 'Airbnb',
        skills: ['User Research', 'Wireframing', 'Figma'],
        avatarColor: '#FF5A5F' // Airbnb Pink
    },
    {
        id: 'u5',
        name: 'Ethan Hunt',
        title: 'Cyber Security Lead',
        company: 'Cloudflare',
        skills: ['Penetration Testing', 'Cryptography', 'Network Security'],
        avatarColor: '#F38020' // Cloudflare Orange
    },
    {
        id: 'u6',
        name: 'Fiona Gallagher',
        title: 'Lead Data Scientist',
        company: 'Meta',
        skills: ['Machine Learning', 'Python', 'A/B Testing'],
        avatarColor: '#0668E1' // Meta Blue
    },
    {
        id: 'u7',
        name: 'George Brooks',
        title: 'Technical Recruiter',
        company: 'Stripe',
        skills: ['Talent Sourcing', 'Salary Negotiation', 'Technical Screening'],
        avatarColor: '#00D4B2' // Stripe Mint
    },
    {
        id: 'u8',
        name: 'Hannah Abbott',
        title: 'Engineering Manager',
        company: 'Uber',
        skills: ['Team Scaling', 'Budgeting', 'Backend Systems'],
        avatarColor: '#1F1F1F' // Uber Dark Grey
    },
    {
        id: 'u9',
        name: 'Ian Somer',
        title: 'Principal Cloud Architect',
        company: 'Amazon Web Services',
        skills: ['Kubernetes', 'Serverless', 'AWS CloudFormation'],
        avatarColor: '#FF9900' // AWS Yellow
    },
    {
        id: 'u10',
        name: 'Julia Roberts',
        title: 'VP of Engineering',
        company: 'Apple',
        skills: ['Leadership', 'Strategic Planning', 'Resource Management'],
        avatarColor: '#999999' // Apple Grey
    }
];

const initialFriendships = [
    ['u1', 'u2'], // Alice - Bob
    ['u1', 'u3'], // Alice - Charlie
    ['u1', 'u4'], // Alice - Diana
    
    ['u2', 'u3'], // Bob - Charlie
    ['u2', 'u6'], // Bob - Fiona
    ['u2', 'u7'], // Bob - George
    
    ['u3', 'u8'], // Charlie - Hannah
    
    ['u4', 'u5'], // Diana - Ethan
    ['u4', 'u6'], // Diana - Fiona
    
    ['u5', 'u8'], // Ethan - Hannah
    ['u5', 'u9'], // Ethan - Ian
    
    ['u6', 'u7'], // Fiona - George
    ['u6', 'u10'], // Fiona - Julia
    
    ['u7', 'u10'], // George - Julia
    
    ['u8', 'u9'], // Hannah - Ian
    
    ['u9', 'u10']  // Ian - Julia
];

// Helper to seed the graph
function seedGraph(graphInstance) {
    initialUsers.forEach(u => {
        graphInstance.addUser(u.id, u.name, u.title, u.company, u.skills, u.avatarColor);
    });
    initialFriendships.forEach(([id1, id2]) => {
        graphInstance.addEdge(id1, id2);
    });
}

// Export if running in node, or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initialUsers, initialFriendships, seedGraph };
} else {
    window.initialUsers = initialUsers;
    window.initialFriendships = initialFriendships;
    window.seedGraph = seedGraph;
}
