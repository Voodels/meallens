package com.meallens.place;

import org.springframework.data.jpa.domain.Specification;

import java.util.UUID;

public class PlaceSpecification {

    // 1 Security Block
    public static Specification<Place> belongsToUser(UUID userID){
        return ((root, query, criteriaBuilder) -> criteriaBuilder.equal(root.get("user").get("id"), userID));
    }
    // the Meal Type Block
    public static Specification<Place> hasMealType(MealType mealType){
        return (root, query, criteriaBuilder) -> mealType==null ? null : criteriaBuilder.equal(root.get("mealType"), mealType);
    }

    // Cntext Block
    public static Specification<Place> hasContext(PlaceContext context){
        return (root,query,criteriaBuilder)-> context==null?null:criteriaBuilder.equal(root.get("context"),context);
    }
    // Global Text Search Block
    public static Specification<Place> searchKeyword(String keyword){
        return (root, query, criteriaBuilder) -> {
            if (keyword == null || keyword.trim().isEmpty())
                return null;
            String likePattern = "%"+keyword.toLowerCase()+"%";
            return criteriaBuilder.or(
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("name")),likePattern),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("area")),likePattern),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("note")),likePattern)
            );
        };
    }


}
