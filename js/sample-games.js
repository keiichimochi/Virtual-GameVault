/**
 * Sample game data for testing Game Shelf
 */

const sampleGames = [
    {
        id: "zelda-botw",
        title: "The Legend of Zelda: Breath of the Wild",
        developer: "Nintendo EPD",
        publisher: "Nintendo",
        releaseDate: "2017-03-03",
        platforms: ["Nintendo Switch", "Wii U"],
        genre: ["Action-adventure", "Open world"],
        description: "オープンワールドのアクションアドベンチャーゲーム。広大なハイラルの世界を自由に探索できます。",
        coverImage: "https://upload.wikimedia.org/wikipedia/en/c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg",
        rating: 5,
        shelves: ["favorites", "completed"]
    },
    {
        id: "minecraft",
        title: "Minecraft",
        developer: "Mojang Studios",
        publisher: "Mojang Studios",
        releaseDate: "2011-11-18",
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"],
        genre: ["Sandbox", "Survival"],
        description: "ブロックで構成された世界で建築や冒険を楽しむサンドボックスゲーム。",
        coverImage: "https://upload.wikimedia.org/wikipedia/en/5/51/Minecraft_cover.png",
        rating: 4,
        shelves: ["playing"]
    },
    {
        id: "mario-odyssey",
        title: "Super Mario Odyssey",
        developer: "Nintendo EPD",
        publisher: "Nintendo",
        releaseDate: "2017-10-27",
        platforms: ["Nintendo Switch"],
        genre: ["Platform", "Action-adventure"],
        description: "マリオが帽子の相棒キャッピーと共に様々な世界を冒険する3Dプラットフォーマー。",
        coverImage: "https://upload.wikimedia.org/wikipedia/en/8/8d/Super_Mario_Odyssey.jpg",
        rating: 5,
        shelves: ["favorites", "completed"]
    },
    {
        id: "ff7-remake",
        title: "Final Fantasy VII Remake",
        developer: "Square Enix",
        publisher: "Square Enix",
        releaseDate: "2020-04-10",
        platforms: ["PlayStation 4", "PlayStation 5", "PC"],
        genre: ["JRPG", "Action RPG"],
        description: "1997年の名作RPGをフルリメイクした作品。美しいグラフィックと新しい戦闘システムが特徴。",
        coverImage: "https://upload.wikimedia.org/wikipedia/en/c/ce/FF7_Remake_cover_art.jpg",
        rating: 4,
        shelves: ["playing"]
    },
    {
        id: "animal-crossing",
        title: "Animal Crossing: New Horizons",
        developer: "Nintendo EPD",
        publisher: "Nintendo",
        releaseDate: "2020-03-20",
        platforms: ["Nintendo Switch"],
        genre: ["Life simulation", "Social simulation"],
        description: "無人島で動物たちと一緒にスローライフを楽しむシミュレーションゲーム。",
        coverImage: "https://upload.wikimedia.org/wikipedia/en/1/1f/Animal_Crossing_New_Horizons.jpg",
        rating: 4,
        shelves: ["playing"]
    }
];

// Function to load sample games
function loadSampleGames() {
    if (window.gameShelf) {
        // Clear existing games
        window.gameShelf.games = [];
        
        // Add sample games
        sampleGames.forEach(game => {
            window.gameShelf.addGame(game);
        });
        
        console.log('Sample games loaded successfully!');
        alert('サンプルゲームを読み込みました！');
    } else {
        console.error('Game Shelf not initialized');
    }
}

// Add load sample games button functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add a button to load sample games
    const managementButtons = document.querySelector('.management-buttons');
    if (managementButtons) {
        const loadSampleBtn = document.createElement('button');
        loadSampleBtn.id = 'load-sample-games';
        loadSampleBtn.className = 'btn btn-secondary';
        loadSampleBtn.innerHTML = '🎮 サンプルゲーム読み込み';
        loadSampleBtn.addEventListener('click', loadSampleGames);
        
        // Insert before the clear library button
        const clearBtn = document.getElementById('clear-library');
        if (clearBtn) {
            managementButtons.insertBefore(loadSampleBtn, clearBtn);
        } else {
            managementButtons.appendChild(loadSampleBtn);
        }
    }
});