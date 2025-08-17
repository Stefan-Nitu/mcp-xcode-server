//
//  Item.swift
//  TestProjectXCTest
//
//  Created by Stefan Dragos Nitu on 17/08/2025.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
